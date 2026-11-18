use anchor_lang::prelude::*;
use anchor_spl::token::{self, CloseAccount, Mint, Token, TokenAccount, TransferChecked};

// Development ID only: run `anchor keys sync` before building a deployment.
declare_id!("12MjjL5UThHbxPBvR7Dus4rAkk1R82Cik8k3fnXzdp1E");
#[cfg(not(feature = "devnet"))]
const USDC: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
#[cfg(feature = "devnet")]
const USDC: &str = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const PAYOUT_WINDOW: i64 = 30 * 60;
const FUNDED: u8 = 0;
const ACCEPTED: u8 = 1;
const PAID: u8 = 2;
const DISPUTED: u8 = 3;
const RELEASED: u8 = 4;
const REFUNDED: u8 = 5;

#[program]
pub mod ryvo_escrow {
    use super::*;
    pub fn initialize(ctx: Context<Initialize>, quote_authority: Pubkey, arbiter: Pubkey) -> Result<()> {
        require!(ctx.accounts.mint.key().to_string() == USDC, EscrowError::WrongMint);
        require_eq!(ctx.accounts.mint.decimals, 6, EscrowError::WrongMint);
        require!(quote_authority != Pubkey::default() && arbiter != Pubkey::default(), EscrowError::Unauthorized);
        ctx.accounts.config.set_inner(Config { authority: ctx.accounts.authority.key(), quote_authority, arbiter, mint: ctx.accounts.mint.key(), paused: true, bump: ctx.bumps.config });
        Ok(())
    }
    // Pausing affects new deposits only. Existing exits never depend on this flag.
    pub fn configure(ctx: Context<Configure>, quote_authority: Pubkey, arbiter: Pubkey, paused: bool) -> Result<()> {
        require!(quote_authority != Pubkey::default() && arbiter != Pubkey::default(), EscrowError::Unauthorized);
        ctx.accounts.config.quote_authority = quote_authority;
        ctx.accounts.config.arbiter = arbiter;
        ctx.accounts.config.paused = paused;
        Ok(())
    }
    pub fn deposit(ctx: Context<Deposit>, order_id: [u8; 16], terms_hash: [u8; 32], amount: u64, quote_expires: i64) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        require!(!ctx.accounts.config.paused, EscrowError::Paused);
        require!(amount > 0 && amount <= 1_000_000_000_000, EscrowError::Amount);
        require!(now < quote_expires && quote_expires <= now.checked_add(600).ok_or(EscrowError::Overflow)?, EscrowError::Expired);
        require_keys_neq!(ctx.accounts.buyer.key(), ctx.accounts.merchant.key(), EscrowError::Unauthorized);
        token::transfer_checked(CpiContext::new(ctx.accounts.token_program.to_account_info(), TransferChecked { from: ctx.accounts.source.to_account_info(), mint: ctx.accounts.mint.to_account_info(), to: ctx.accounts.vault.to_account_info(), authority: ctx.accounts.buyer.to_account_info() }), amount, 6)?;
        ctx.accounts.escrow.set_inner(Escrow { order_id, buyer: ctx.accounts.buyer.key(), merchant: ctx.accounts.merchant.key(), mint: ctx.accounts.mint.key(), arbiter: ctx.accounts.config.arbiter, terms_hash, amount, payout_deadline: now.checked_add(PAYOUT_WINDOW).ok_or(EscrowError::Overflow)?, state: FUNDED, bump: ctx.bumps.escrow });
        Ok(())
    }
    // Commit BEFORE sending fiat. This disables unilateral buyer timeout refunds.
    pub fn accept_payout(ctx: Context<MerchantAction>) -> Result<()> {
        require_eq!(ctx.accounts.escrow.state, FUNDED, EscrowError::State);
        require!(Clock::get()?.unix_timestamp < ctx.accounts.escrow.payout_deadline, EscrowError::Expired);
        ctx.accounts.escrow.state = ACCEPTED;
        Ok(())
    }
    pub fn mark_paid(ctx: Context<MerchantAction>) -> Result<()> {
        require_eq!(ctx.accounts.escrow.state, ACCEPTED, EscrowError::State);
        ctx.accounts.escrow.state = PAID;
        Ok(())
    }
    pub fn dispute(ctx: Context<Dispute>) -> Result<()> {
        require!(ctx.accounts.escrow.state <= PAID, EscrowError::State);
        let actor = ctx.accounts.actor.key();
        require!(actor == ctx.accounts.escrow.buyer || actor == ctx.accounts.escrow.merchant, EscrowError::Unauthorized);
        ctx.accounts.escrow.state = DISPUTED;
        Ok(())
    }
    pub fn release(ctx: Context<Settle>) -> Result<()> {
        require_keys_eq!(ctx.accounts.actor.key(), ctx.accounts.escrow.buyer, EscrowError::Unauthorized);
        require!(ctx.accounts.escrow.state == ACCEPTED || ctx.accounts.escrow.state == PAID, EscrowError::State);
        require_keys_eq!(ctx.accounts.destination.owner, ctx.accounts.escrow.merchant, EscrowError::Destination);
        settle_tokens(ctx, RELEASED)
    }
    pub fn refund_timeout(ctx: Context<Settle>) -> Result<()> {
        require_keys_eq!(ctx.accounts.actor.key(), ctx.accounts.escrow.buyer, EscrowError::Unauthorized);
        require_eq!(ctx.accounts.escrow.state, FUNDED, EscrowError::State);
        require!(Clock::get()?.unix_timestamp >= ctx.accounts.escrow.payout_deadline, EscrowError::TooEarly);
        require_keys_eq!(ctx.accounts.destination.owner, ctx.accounts.escrow.buyer, EscrowError::Destination);
        settle_tokens(ctx, REFUNDED)
    }
    pub fn resolve_dispute(ctx: Context<Settle>, release_to_merchant: bool) -> Result<()> {
        require_eq!(ctx.accounts.escrow.state, DISPUTED, EscrowError::State);
        // The arbiter is snapshotted at deposit; config changes cannot seize old orders.
        require_keys_eq!(ctx.accounts.actor.key(), ctx.accounts.escrow.arbiter, EscrowError::Unauthorized);
        let recipient = if release_to_merchant { ctx.accounts.escrow.merchant } else { ctx.accounts.escrow.buyer };
        require_keys_eq!(ctx.accounts.destination.owner, recipient, EscrowError::Destination);
        settle_tokens(ctx, if release_to_merchant { RELEASED } else { REFUNDED })
    }
}

fn settle_tokens(ctx: Context<Settle>, terminal: u8) -> Result<()> {
    let escrow = &ctx.accounts.escrow;
    require!(escrow.state < RELEASED, EscrowError::State);
    require!(ctx.accounts.vault.amount >= escrow.amount, EscrowError::Amount);
    let bump = [escrow.bump];
    let seeds: &[&[u8]] = &[b"escrow", escrow.buyer.as_ref(), escrow.order_id.as_ref(), &bump];
    let signers = &[seeds];
    // Send any same-mint donations with the principal, so dust cannot block closing.
    token::transfer_checked(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), TransferChecked { from: ctx.accounts.vault.to_account_info(), mint: ctx.accounts.mint.to_account_info(), to: ctx.accounts.destination.to_account_info(), authority: ctx.accounts.escrow.to_account_info() }, signers), ctx.accounts.vault.amount, 6)?;
    token::close_account(CpiContext::new_with_signer(ctx.accounts.token_program.to_account_info(), CloseAccount { account: ctx.accounts.vault.to_account_info(), destination: ctx.accounts.buyer_rent.to_account_info(), authority: ctx.accounts.escrow.to_account_info() }, signers))?;
    ctx.accounts.escrow.state = terminal;
    // Keep the escrow receipt account as a tombstone. The same order can never reinitialize.
    Ok(())
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)] pub authority: Signer<'info>,
    #[account(init, payer=authority, space=8+Config::INIT_SPACE, seeds=[b"config"], bump)] pub config: Account<'info, Config>,
    pub mint: Account<'info, Mint>,
    #[account(constraint=program.programdata_address()? == Some(program_data.key()))] pub program: Program<'info, crate::program::RyvoEscrow>,
    #[account(constraint=program_data.upgrade_authority_address == Some(authority.key()) @ EscrowError::Unauthorized)] pub program_data: Account<'info, ProgramData>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct Configure<'info> {
    pub authority: Signer<'info>,
    #[account(mut, seeds=[b"config"], bump=config.bump, has_one=authority)] pub config: Account<'info, Config>,
}
#[derive(Accounts)]
#[instruction(order_id: [u8;16])]
pub struct Deposit<'info> {
    #[account(mut)] pub buyer: Signer<'info>,
    pub quote_authority: Signer<'info>,
    /// CHECK: Recipient wallet is fixed by a server-signed quote, never a transfer authority.
    pub merchant: UncheckedAccount<'info>,
    #[account(seeds=[b"config"], bump=config.bump, has_one=mint, has_one=quote_authority)] pub config: Account<'info, Config>,
    #[account(init, payer=buyer, space=8+Escrow::INIT_SPACE, seeds=[b"escrow",buyer.key().as_ref(),order_id.as_ref()], bump)] pub escrow: Account<'info, Escrow>,
    #[account(init, payer=buyer, seeds=[b"vault",escrow.key().as_ref()], bump, token::mint=mint, token::authority=escrow)] pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint=mint, token::authority=buyer)] pub source: Account<'info, TokenAccount>,
    #[account(address=config.mint)] pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
#[derive(Accounts)]
pub struct MerchantAction<'info> {
    pub merchant: Signer<'info>,
    #[account(mut, seeds=[b"escrow",escrow.buyer.as_ref(),escrow.order_id.as_ref()], bump=escrow.bump, has_one=merchant)] pub escrow: Account<'info, Escrow>,
}
#[derive(Accounts)]
pub struct Dispute<'info> {
    pub actor: Signer<'info>,
    #[account(mut, seeds=[b"escrow",escrow.buyer.as_ref(),escrow.order_id.as_ref()], bump=escrow.bump)] pub escrow: Account<'info, Escrow>,
}
#[derive(Accounts)]
pub struct Settle<'info> {
    pub actor: Signer<'info>,
    #[account(mut, seeds=[b"escrow",escrow.buyer.as_ref(),escrow.order_id.as_ref()], bump=escrow.bump, has_one=mint)] pub escrow: Account<'info, Escrow>,
    #[account(mut, seeds=[b"vault",escrow.key().as_ref()], bump, token::mint=mint, token::authority=escrow)] pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint=mint)] pub destination: Account<'info, TokenAccount>,
    #[account(address=escrow.mint)] pub mint: Account<'info, Mint>,
    #[account(mut, address=escrow.buyer)] pub buyer_rent: SystemAccount<'info>,
    pub token_program: Program<'info, Token>,
}
#[account]
#[derive(InitSpace)]
pub struct Config { pub authority: Pubkey, pub quote_authority: Pubkey, pub arbiter: Pubkey, pub mint: Pubkey, pub paused: bool, pub bump: u8 }
#[account]
#[derive(InitSpace)]
pub struct Escrow { pub order_id: [u8;16], pub buyer: Pubkey, pub merchant: Pubkey, pub mint: Pubkey, pub arbiter: Pubkey, pub terms_hash: [u8;32], pub amount: u64, pub payout_deadline: i64, pub state: u8, pub bump: u8 }
#[error_code]
pub enum EscrowError {
    #[msg("Only canonical USDC with six decimals is supported.")] WrongMint,
    #[msg("This signer is not authorized.")] Unauthorized,
    #[msg("New deposits are paused.")] Paused,
    #[msg("Invalid or insufficient USDC amount.")] Amount,
    #[msg("Quote or payout acceptance window expired.")] Expired,
    #[msg("This escrow state does not allow the action.")] State,
    #[msg("The refund deadline has not arrived.")] TooEarly,
    #[msg("The destination must belong to the fixed buyer or merchant.")] Destination,
    #[msg("Timestamp overflow.")] Overflow,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn account_sizes_match_the_web_decoder() { assert_eq!(Escrow::INIT_SPACE+8,202); assert_eq!(Config::INIT_SPACE+8,138); }
    #[test] fn terminal_states_cannot_be_reused() { assert!(RELEASED>DISPUTED); assert!(REFUNDED>DISPUTED); assert_eq!(PAYOUT_WINDOW,1800); }
}
