"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

import type { User } from "@supabase/supabase-js";

import { Icon } from "@/components/collection-art";
import { RyvoSelect } from "@/components/ryvo-select";
import {
  LEVELS,
  POPULATION_TIERS,
  isReferralScheme,
  populationTierFor,
  schemeLabel,
  type PlayerLevel,
  type ReferralScheme,
} from "@/lib/levels";
import { supabase } from "@/lib/supabase";

const referralMoney = (value: number) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);

const levelBands = [
  { levels: "Levels 1–2", rate: 10 },
  { levels: "Levels 3–4", rate: 20 },
  { levels: "Levels 5–6", rate: 30 },
  { levels: "Levels 7–8", rate: 40 },
  { levels: "Levels 9–10", rate: 50 },
];

/**
 * The squad page owns the referral programme decision.
 *
 * A player can earn commission through exactly one programme, and the choice is
 * made once: the level programme (the rate follows the level earned by
 * completing boards) or the population programme (the rate follows how many
 * players Ryvo has, starting high while the platform is small). Until a
 * programme is activated the page only offers one button; that button opens
 * the two programmes over a blurred page, and choosing one records it on the
 * account for good.
 */
export function ReferralsPage({
  username,
  level,
  players,
  scheme,
  onUser,
}: {
  username: string;
  level: PlayerLevel;
  players: number;
  scheme: ReferralScheme | null;
  onUser: (user: User) => void;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState("");
  const [entry, setEntry] = useState("1000");
  const [count, setCount] = useState("5");
  const [preview, setPreview] = useState<ReferralScheme>("level");
  const [open, setOpen] = useState(false);
  const [activating, setActivating] = useState<ReferralScheme | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setOrigin(window.location.origin), 0);
    return () => clearTimeout(timer);
  }, []);

  // The programme dialog is modal: the page behind it stops scrolling, and the
  // button that opened it takes focus back once the dialog closes.
  useEffect(() => {
    if (!open) return;
    const opener = trigger.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      opener?.focus();
    };
  }, [open]);

  const link = origin && username ? `${origin}/onboarding?ref=${encodeURIComponent(username)}` : "";
  const populationTier = populationTierFor(players);
  // Before the choice is locked the calculator previews a programme, so nobody
  // has to activate an account just to see their rate.
  const shown = scheme ?? preview;
  const rate = shown === "population" ? populationTier.rate : level.rate;

  const amount = Number(entry);
  const referrals = Number(count);
  const valid =
    Number.isSafeInteger(amount) &&
    amount > 0 &&
    amount <= 1000000 &&
    Number.isSafeInteger(referrals) &&
    referrals >= 1 &&
    referrals <= 10000;
  const reward = valid ? (amount * referrals * rate) / 100 : 0;

  async function activate(next: ReferralScheme) {
    setActivating(next);
    setError("");
    try {
      const db = supabase();
      const { data: current, error: readError } = await db.auth.getUser();
      if (readError || !current.user) throw Error("Sign in to activate a referral programme.");
      if (isReferralScheme(current.user.user_metadata.referral_scheme))
        throw Error("Your referral programme is already active and can’t be changed.");
      const { data, error: saveError } = await db.auth.updateUser({ data: { referral_scheme: next } });
      if (saveError || !data.user) throw Error("Your programme couldn’t be activated. Please try again.");
      onUser(data.user);
      setStatus(`${schemeLabel(next)} activated. Your commission is locked to this account.`);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to activate your referral programme.");
    } finally {
      setActivating(null);
    }
  }

  function closeDialog() {
    if (activating) return;
    setOpen(false);
  }

  // Keeps Tab inside the dialog while it is open, so the blurred page behind it
  // never takes focus.
  function keepFocusInside(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const items = panel.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled),a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])',
    );
    if (!items?.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="squad-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">BUILD YOUR SQUAD. BOOST YOUR REWARDS.</p>
          <h1>
            Bring your squad<span>.</span>
          </h1>
          <p className="subheading">More players in the game. More rewards for you.</p>
        </div>
        <span className={`squad-phase ${scheme ? "" : "is-open"}`}>
          {scheme ? `${schemeLabel(scheme)} · Locked` : "PROGRAMME NOT ACTIVE"}
        </span>
      </div>

      {status && (
        <p className="squad-activated" role="status">
          {status}
        </p>
      )}

      {!scheme && (
        <section className="squad-activate">
          <div>
            <p className="eyebrow">REFERRAL PROGRAMME</p>
            <h2>Activate to start earning.</h2>
            <p>Two programmes. One permanent choice per account. Your commission follows whichever you pick.</p>
          </div>
          <div className="squad-activate-action">
            <button className="primary" ref={trigger} disabled={!username} onClick={() => setOpen(true)}>
              Activate Referral Program
              <Icon name="arrow" size={17} />
            </button>
            <p>
              {username
                ? "Nothing is charged. The programme cannot be switched later."
                : "Sign in to activate a programme on your account."}
            </p>
          </div>
        </section>
      )}

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="squad-choice-backdrop"
            onMouseDown={event => {
              if (event.target === event.currentTarget) closeDialog();
            }}
            onKeyDown={event => {
              if (event.key === "Escape") closeDialog();
              else keepFocusInside(event);
            }}
          >
            <div
              className="squad-choice"
              role="dialog"
              aria-modal="true"
              aria-labelledby="squad-choice-title"
              aria-describedby="squad-choice-copy"
              tabIndex={-1}
              ref={panel}
            >
              <div className="squad-choice-head">
                <div>
                  <p className="eyebrow">TWO PROGRAMMES. ONE CHOICE.</p>
                  <h2 id="squad-choice-title">How should you earn?</h2>
                  <p id="squad-choice-copy">
                    Activating a programme records it on your account immediately. It cannot be changed afterwards, so
                    pick the one that suits how you play.
                  </p>
                </div>
                <button
                  className="squad-choice-close"
                  type="button"
                  aria-label="Close programme selection"
                  disabled={Boolean(activating)}
                  onClick={closeDialog}
                >
                  <Icon name="close" size={18} />
                </button>
              </div>

              <div className="squad-scheme-grid">
                <article className="squad-scheme-card squad-choice-card">
                  <p className="eyebrow">LEVEL PROGRAMME</p>
                  <h3>Your level sets your rate.</h3>
                  <p>Complete boards, reach a level, and earn a bigger share of every referred registration fee.</p>
                  <div className="squad-scheme-list">
                    {levelBands.map(band => (
                      <div key={band.levels} className={level.rate === band.rate ? "is-current" : ""}>
                        <span>{band.levels}</span>
                        <b>{band.rate}%</b>
                      </div>
                    ))}
                  </div>
                  <p className="squad-scheme-now">
                    You are level {level.level} · {level.name} → <b>{level.rate}% now</b>
                  </p>
                  <button
                    className="primary"
                    type="button"
                    disabled={Boolean(activating)}
                    onClick={() => void activate("level")}
                  >
                    {activating === "level" ? "Activating…" : "Activate level programme"}
                  </button>
                </article>

                <article className="squad-scheme-card squad-choice-card">
                  <p className="eyebrow">POPULATION PROGRAMME</p>
                  <h3>Ryvo’s size sets your rate.</h3>
                  <p>The rate starts at its highest while the platform is small, then steps down as Ryvo grows.</p>
                  <div className="squad-scheme-list">
                    {POPULATION_TIERS.map(tier => (
                      <div key={tier.from} className={populationTier.from === tier.from ? "is-current" : ""}>
                        <span>{tier.label}</span>
                        <b>{tier.rate}%</b>
                      </div>
                    ))}
                  </div>
                  <p className="squad-scheme-now">
                    Ryvo now: {players.toLocaleString()} players → <b>{populationTier.rate}% now</b>
                  </p>
                  <button
                    className="primary"
                    type="button"
                    disabled={Boolean(activating)}
                    onClick={() => void activate("population")}
                  >
                    {activating === "population" ? "Activating…" : "Activate population programme"}
                  </button>
                </article>
              </div>

              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}

              <p className="squad-choice-foot">
                Commission applies to eligible competition entry payments from players who join with your invite link. No
                charge is made now.
              </p>
            </div>
          </div>,
          document.body,
        )}

      <section className="squad-hero">
        <div>
          <p className="eyebrow">{scheme ? schemeLabel(scheme).toUpperCase() : "YOUR PROGRAMME PREVIEW"}</p>
          <h2>
            They join the game.
            <br />
            You earn <em>{rate}%.</em>
          </h2>
          <p>
            {shown === "population"
              ? `Commission follows Ryvo’s total player count. You are in the ${populationTier.label.toLowerCase()} phase, so you earn ${rate}% of eligible registration fees from players you refer.`
              : `Commission follows your level. At level ${level.level} · ${level.name} you earn ${rate}% of eligible registration fees from players you refer.`}
          </p>
          <span>Example: an eligible ₦1,000 entry → ₦{(1000 * rate) / 100} for you.</span>
        </div>
        <div className="squad-hero-art">
          <Image className="squad-ryvo-logo" src="/ryvo-logo.png" alt="" width={220} height={220} />
          <b>
            {rate}
            <small>%</small>
          </b>
          <p>
            YOUR {scheme ? schemeLabel(scheme).toUpperCase() : "PREVIEW"}
            <br />
            REFERRAL RATE
          </p>
        </div>
      </section>

      <section className="squad-invite">
        <div>
          <p className="eyebrow">YOUR SQUAD STARTS WITH A LINK</p>
          <h2>Pass the invite.</h2>
          <p>Share your invite link with your next teammate.</p>
        </div>
        <div>
          <label htmlFor="referral-link">Your invite link</label>
          <div className="squad-link">
            <input id="referral-link" readOnly value={link} placeholder="Preparing your link…" onFocus={e => e.target.select()} />
            <button
              disabled={!link}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied("Invite link copied. Send it to your squad.");
                } catch {
                  setCopied("Select the link and copy it to share.");
                }
              }}
            >
              <Icon name="referrals" size={16} />
              Copy link
            </button>
          </div>
          <p role="status">{copied || `Player code: ${username || "Sign in to get your code"}`}</p>
        </div>
      </section>

      <div className="squad-reward-grid">
        <section className="squad-universal">
          <span className="squad-universal-star">✳</span>
          <p className="eyebrow">ANOTHER WAY TO LEVEL UP</p>
          <h2>
            Five players.
            <br />
            One Universal Piece.
          </h2>
          <p>
            Every five qualifying referrals earns one Universal Piece, on top of your commission. The milestones keep
            stacking.
          </p>
          <div className="squad-milestones">
            {[["5", "1"], ["10", "2"], ["15", "3"]].map(([people, pieces]) => (
              <div key={people}>
                <b>{people}</b>
                <span>qualifying referrals</span>
                <strong>{pieces} ✳</strong>
              </div>
            ))}
          </div>
          <small>Cumulative rewards: 5 = 1, 10 = 2, 15 = 3 Universal Pieces.</small>
        </section>

        <section className="squad-calculator">
          <p className="eyebrow">PLAN YOUR NEXT INVITE</p>
          <h2>What could your squad earn?</h2>
          <p>Estimate your reward. This does not add funds or pieces to your wallet.</p>
          <label>
            Programme
            <RyvoSelect
              label="Referral programme"
              value={shown}
              onValueChange={value => {
                if (!scheme && isReferralScheme(value)) setPreview(value);
              }}
              options={[
                { value: "level", label: `Level programme · ${level.rate}%` },
                { value: "population", label: `Population programme · ${populationTier.rate}%` },
              ]}
            />
          </label>
          {scheme && <p className="squad-calculator-locked">Locked to your {schemeLabel(scheme).toLowerCase()}.</p>}
          <div className="squad-calculator-inputs">
            <label>
              Entry value per player (₦)
              <input
                aria-label="Entry value per player in naira"
                type="number"
                min={1}
                max={1000000}
                step={1}
                value={entry}
                onChange={e => setEntry(e.target.value)}
              />
            </label>
            <label>
              Qualifying referrals
              <input
                aria-label="Qualifying referrals to estimate"
                type="number"
                min={1}
                max={10000}
                step={1}
                value={count}
                onChange={e => setCount(e.target.value)}
              />
            </label>
          </div>
          {valid ? (
            <div className="squad-estimate" aria-live="polite">
              <div>
                <span>Estimated commission · {rate}%</span>
                <b>{referralMoney(reward)}</b>
              </div>
              <div>
                <span>Universal Piece milestone reward</span>
                <b>{Math.floor(referrals / 5)} ✳</b>
              </div>
            </div>
          ) : (
            <p className="error">
              Enter whole naira amounts from 1 to 1,000,000 and a referral count from 1 to 10,000.
            </p>
          )}
          <small>Entry values are shown in naira equivalent. Registration provides RYVO Credit for piece purchases.</small>
        </section>
      </div>

      <section className="squad-tiers">
        <div>
          <p className="eyebrow">{shown === "population" ? "AS RYVO GROWS" : "AS YOU LEVEL UP"}</p>
          <h2>
            {shown === "population" ? "The game grows." : "Boards open doors."}
            <br />
            {shown === "population" ? "The rate changes." : "The rate climbs."}
          </h2>
          <p>
            {shown === "population"
              ? "The threshold is Ryvo’s total platform player count. It isn’t your payment total or the number of players you personally invite."
              : "Levels come from completing boards. Every board you finish moves you toward the next band and a higher share."}
          </p>
        </div>
        <div>
          {shown === "population"
            ? POPULATION_TIERS.map(tier => (
                <article className={populationTier.from === tier.from ? "current" : ""} key={tier.from}>
                  <span>
                    <b>{tier.label}</b>
                    {populationTier.from === tier.from && <small>CURRENT PHASE</small>}
                  </span>
                  <strong>{tier.rate}%</strong>
                </article>
              ))
            : LEVELS.map(row => (
                <article className={row.level === level.level ? "current" : ""} key={row.level}>
                  <span>
                    <b>
                      Level {row.level} · {row.name}
                    </b>
                    <small>
                      {row.minBoards} {row.minBoards === 1 ? "board" : "boards"}
                      {row.level === level.level && " · YOU ARE HERE"}
                    </small>
                  </span>
                  <strong>{row.rate}%</strong>
                </article>
              ))}
        </div>
      </section>

      <section className="squad-rules">
        <h2>Know your rewards.</h2>
        <div>
          <article>
            <Icon name="check" />
            <h3>Eligible entry payments</h3>
            <p>
              Commission follows eligible competition entry payments. Wallet funding, swaps and marketplace resales
              aren’t counted again as entry revenue.
            </p>
          </article>
          <article>
            <Icon name="time" />
            <h3>One programme, for good</h3>
            <p>
              A programme is chosen once. Activating it records the choice on your account, and support cannot move
              that account to the other programme.
            </p>
          </article>
          <article>
            <Icon name="referrals" />
            <h3>Real players. Fair play.</h3>
            <p>
              Only qualifying referrals count. Self-referrals, duplicate accounts and ineligible activity don’t earn
              commission or milestone rewards.
            </p>
          </article>
        </div>
      </section>
      <p className="squad-demo-note">
        Referral rewards open when verified competition payments are available. This calculator provides estimates; it
        does not issue rewards.
      </p>
    </div>
  );
}
