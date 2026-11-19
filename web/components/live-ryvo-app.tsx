"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import type { User } from "@supabase/supabase-js";

import { BackLink } from "@/components/back-button";
import { Artwork, Icon } from "@/components/collection-art";
import { CollectionOpening } from "@/components/collection-opening";
import { WalletPage } from "@/components/wallet-page";
import { JoinCompetition } from "@/components/join-competition";
import { LiveCreate } from "@/components/live-create";
import { LiquidGlass } from "@/components/premium/liquid-glass";
import { EditProfile } from "@/components/edit-profile";
import { MerchantDirectory } from "@/components/merchant-directory";
import { NavigationFeedback } from "@/components/navigation-feedback";
import { PlayerAvatar, PlayerProfile } from "@/components/player-profile";
import { ReferralsPage } from "@/components/referrals-page";
import { RyvoSelect } from "@/components/ryvo-select";
import { SceneBanner } from "@/components/scene-banner";
import { TokenWalletCard } from "@/components/token-experience";

import { credit, money, type Competition, type DemoState } from "@/lib/demo";
import {
  clearSnapshot,
  getServerSnapshot,
  patchSnapshotUser,
  readSnapshot,
  subscribeSnapshot,
  writeSnapshot,
} from "@/lib/live-cache";
import { loadLiveData } from "@/lib/live-data";
import { completedBoards, isReferralScheme, levelFor, levelProgress } from "@/lib/levels";
import { supabase } from "@/lib/supabase";

type View =
  | "explore"
  | "boards"
  | "wallet"
  | "referrals"
  | "p2p"
  | "notifications"
  | "profile"
  | "create"
  | "edit-profile";

type Live = {
  userId: string | null;
  state: DemoState;
  catalog: Competition[];
  tokens: number;
};

const navigation = [
  ["explore", "Explore"],
  ["boards", "Boards"],
  ["create", "Create"],
  ["referrals", "Invite"],
  ["profile", "Profile"],
] as const;

const pathFor = (view: View) =>
  view === "p2p" ? "/wallet" : view === "edit-profile" ? "/profile/edit" : `/${view}`;

export function LiveRyvoApp({
  initialView = "explore",
  collectionId,
  boardView = false,
}: {
  initialView?: View;
  collectionId?: string;
  boardView?: boolean;
}) {
  const router = useRouter();
  // Last known account, read through an external store so navigating between
  // routes never empties the balance while the refresh is in flight.
  const cached = useSyncExternalStore(subscribeSnapshot, readSnapshot, getServerSnapshot);
  const owner = useRef<string | null | undefined>(undefined);
  const [account, setAccount] = useState<User | null | undefined>(undefined);
  const [live, setLive] = useState<Live | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [filter, setFilter] = useState("All collections");

  useEffect(() => {
    let active = true;

    const read = async () => {
      setError("");
      try {
        const db = supabase();
        const { data, error: authError } = await db.auth.getUser();
        if (authError && authError.name !== "AuthSessionMissingError") throw authError;
        const current = data.user ?? null;
        if (!active) return;
        owner.current = current?.id ?? null;
        setAccount(current);
        const result = await loadLiveData(current);
        if (!active) return;
        const next: Live = {
          userId: current?.id ?? null,
          state: result.state,
          catalog: result.competitions,
          tokens: result.tokens,
        };
        setLive(next);
        writeSnapshot({ ...next, user: current });
      } catch {
        if (active) setError("We couldn’t load the latest game data. Please try again shortly.");
      }
    };

    void read();
    let unsubscribe: (() => void) | undefined;
    try {
      const { data } = supabase().auth.onAuthStateChange((event, session) => {
        if (!active) return;
        setAccount(session?.user ?? null);
        if (event === "SIGNED_OUT") {
          owner.current = null;
          setLive(null);
          clearSnapshot();
        } else if (event === "SIGNED_IN" && owner.current !== (session?.user.id ?? null)) {
          owner.current = session?.user.id ?? null;
          setRetry(value => value + 1);
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch {}
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [retry]);

  const currentId = account !== undefined ? (account?.id ?? null) : (cached?.userId ?? null);
  const data: Live | null =
    live && live.userId === currentId
      ? live
      : cached && cached.userId === currentId
        ? { userId: cached.userId, state: cached.state, catalog: cached.catalog, tokens: cached.tokens }
        : null;
  const user = account !== undefined ? account : (cached?.user ?? null);

  const state = data?.state ?? null;
  const catalog = data?.catalog ?? [];
  const tokens = data?.tokens ?? 0;
  const price = state ? state.balance.toLocaleString() : "—";

  const completed = state ? completedBoards(state, catalog) : 0;
  const level = levelFor(completed);
  const players = state?.platformPlayers ?? 0;
  const storedScheme = user?.user_metadata.referral_scheme;
  const scheme = isReferralScheme(storedScheme) ? storedScheme : null;

  const detail = catalog.find(c => c.id === collectionId);
  const shown = catalog.filter(c => filter === "All collections" || filter === c.category);
  const boards = state ? Object.keys(state.boards).length : 0;
  const ledger = state?.ledger ?? [];

  const acceptUser = (next: User) => {
    setAccount(next);
    patchSnapshotUser(next);
  };

  const logout = async () => {
    setError("");
    try {
      const { error: signOutError } = await supabase().auth.signOut();
      if (signOutError) throw signOutError;
      router.push("/signin");
    } catch {
      setError("Unable to sign out. Please try again.");
    }
  };

  const accountLink = (
    <Link className="primary" href={`/signup?next=${pathFor(initialView)}`}>
      Create your account <Icon name="arrow" />
    </Link>
  );

  const paymentNote = (
    <p className="live-service-note">
      P2P funding is available through approved merchants when trading is open. Competition payments, swaps and
      withdrawals are not available yet.
    </p>
  );

  const active = initialView === "edit-profile" ? "profile" : initialView;

  return (
    <div className="app-shell">
      <a className="skip-to-game" href="#ryvo-content">
        Skip to game
      </a>
      <LiquidGlass as="nav" className="floating-taskbar" aria-label="App navigation" bezel={14} refraction={28}>
        {navigation.map(([key, label]) => (
          <Link
            key={key}
            href={pathFor(key)}
            aria-current={active === key ? "page" : undefined}
            className={active === key ? "active" : ""}
          >
            {key === "create" ? (
              <Image className="taskbar-ryvo-logo" src="/ryvo-logo.png" alt="" width={28} height={28} />
            ) : (
              <Icon name={key} />
            )}
            <span>{label}</span>
            <NavigationFeedback active={active === key} />
          </Link>
        ))}
      </LiquidGlass>
      <div className="workspace">
        <header className="topbar">
          <Link href="/" className="app-brand">
            <Image src="/ryvo-logo.png" alt="" width={38} height={38} />
            <b>Ryvo</b>
          </Link>
          <div className="breadcrumb">
            Your next round awaits <span>↗</span>
          </div>
          <div className="top-actions">
            <Link className="balance-pill" href="/wallet">
              <span className="currency-symbol">r/</span>
              {price}
            </Link>
            <Link href="/notifications" className="icon-button notification" aria-label="Open notifications">
              <Icon name="bell" />
            </Link>
            <Link href="/profile" className="avatar" aria-label="Open your profile">
              <PlayerAvatar user={user} />
            </Link>
          </div>
        </header>
        <main id="ryvo-content" tabIndex={-1}>
          {collectionId && <CollectionOpening key={collectionId} board={boardView} />}

          {error && (
            <div className="live-status" role="alert">
              <p>{error}</p>
              <button className="secondary" onClick={() => setRetry(value => value + 1)}>
                Try again
              </button>
            </div>
          )}

          {collectionId ? (
            !data ? (
              <div className="live-loading" role="status">
                Getting your game ready…
              </div>
            ) : (
              <>
                <BackLink href="/explore" ariaLabel="Back to explore" />
                {detail ? (
                  <section className="live-collection">
                    <div className="live-collection-art">
                      <Artwork theme={detail.theme} />
                    </div>
                    <h1>{detail.title}</h1>
                    <p>{detail.description}</p>
                    <div className="live-facts">
                      <span>
                        Registration<b>{money(detail.fee)}</b>
                      </span>
                      <span>
                        Players<b>{detail.joined} / {detail.capacity}</b>
                      </span>
                      <span>
                        Prize pool<b>{money(detail.prize)}</b>
                      </span>
                    </div>
                    <p>
                      {detail.total} pieces · {detail.winners} winner slots
                    </p>
                    <JoinCompetition
                      competition={detail}
                      user={user}
                      joined={Boolean(state?.boards[detail.id])}
                      onJoined={() => setRetry(value => value + 1)}
                    />
                  </section>
                ) : (
                  <Empty
                    title="This competition is unavailable."
                    text="Explore the latest challenges to find your next game."
                    href="/explore"
                    label="Explore challenges"
                  />
                )}
              </>
            )
          ) : (
            <>
              {initialView === "explore" && (
                <>
                  <div className="play-home-heading">
                    <h1>Let’s play.</h1>
                  </div>
                  <SceneBanner
                    title="Your next move. A whole new picture."
                    text="Find the pieces. Trade your extras. Play for the complete board."
                    href="/how-it-works"
                    label="How to play"
                  />
                  <div className="live-home-grid live-home-grid-single">
                    <section className="home-launch">
                      <div className="home-launch-label">
                        <Image src="/ryvo-logo.png" alt="" width={28} height={28} />
                        <span>Made by you. Played by everyone.</span>
                      </div>
                      <h2>
                        Turn your art into{" "}
                        <br />
                        the next challenge.
                      </h2>
                      <p>Your artwork. Your community. One complete picture.</p>
                      <Link href="/create">
                        Create a competition
                        <Icon name="arrow" />
                      </Link>
                    </section>
                  </div>
                  <div className="section-heading challenge-list-heading">
                    <h2 className="challenge-list-title">
                      <span>Pick your</span>
                      <span>
                        challenge<span className="lime-dot" />
                      </span>
                    </h2>
                    <RyvoSelect
                      label="Filter challenges"
                      value={filter}
                      onValueChange={setFilter}
                      options={["All collections", "3D Art", "Abstract", "Digital Art"].map(value => ({
                        value,
                        label: value,
                      }))}
                    />
                  </div>
                  {shown.length ? (
                    <div className="collection-grid">
                      {shown.map(competition => (
                        <Link className="live-game-card" href={`/collection/${competition.id}`} key={competition.id}>
                          <div>
                            <Artwork theme={competition.theme} />
                          </div>
                          <h2>{competition.title}</h2>
                          <p>
                            {competition.joined} / {competition.capacity} players · {competition.total} pieces
                          </p>
                          <b>{money(competition.prize)} prize pool</b>
                          <span>
                            View challenge <Icon name="arrow" />
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title={error ? "Challenges are taking a moment." : "The next race starts here."}
                      text={
                        error
                          ? "Try again to load the latest competitions."
                          : "New competitions will appear here when creators launch them."
                      }
                    />
                  )}
                </>
              )}

              {initialView === "boards" && (
                <>
                  <h1 className="player-page-title">Boards</h1>
                  <SceneBanner
                    title="Every piece brings you closer."
                    text="Your collection. Your progress. Your race to the finish."
                    theme="bloom"
                  />
                  {boards ? (
                    <div className="collection-grid">
                      {Object.entries(state?.boards ?? {}).map(([id, pieces]) => (
                        <Link className="live-game-card" href={`/board/${id}`} key={id}>
                          <h2>{catalog.find(competition => competition.id === id)?.title ?? "Your competition"}</h2>
                          <p>{pieces.length} unique pieces collected</p>
                          <span>
                            View board <Icon name="arrow" />
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Empty
                      title="Your first board is waiting."
                      text="Join a competition to begin collecting."
                      href="/explore"
                      label="Explore challenges"
                    />
                  )}
                </>
              )}

              {(initialView === "wallet" || initialView === "p2p") && (
                <>
                  <div className="page-heading">
                    <div>
                      <h1>{initialView === "p2p" ? "Meet your merchants." : "Your wallet."}</h1>
                      <p className="subheading">{initialView === "p2p" ? "Your credit. Your earnings. Your next move." : "Your Solana wallet, RYVO Credit and earnings."}</p>
                    </div>
                  </div>
                  {initialView === "p2p" ? (
                    <>
                      <BackLink href="/wallet" ariaLabel="Back to wallet" />
                      <MerchantDirectory />
                    </>
                  ) : (
                    <>
                      <WalletPage
                        creditBalance={price}
                        activity={ledger}
                        signedIn={Boolean(user)}
                        tokenCard={state && !error ? <TokenWalletCard state={state} earned={tokens} /> : null}
                      />
                    </>
                  )}
                  {paymentNote}
                  {!user && accountLink}
                </>
              )}

              {initialView === "notifications" && (
                <>
                  <div className="play-home-heading">
                    <h1>Notifications.</h1>
                  </div>
                  <p className="subheading create-subheading">Your game, collection and wallet updates.</p>
                  <SceneBanner
                    title="The game keeps moving."
                    text="Your latest updates, together in one place."
                    theme="bloom"
                  />
                  {ledger.length ? (
                    <section className="ops-panel">
                      {ledger.map(entry => (
                        <article className="ops-order-row" key={entry.id}>
                          <Icon name="wallet" />
                          <div>
                            <b>{entry.label}</b>
                            <small>{new Date(entry.date).toLocaleDateString("en-NG")}</small>
                          </div>
                          <strong>
                            {entry.amount > 0 ? "+" : ""}
                            {entry.currency === "RYVO" ? credit(entry.amount) : money(entry.amount)}
                          </strong>
                        </article>
                      ))}
                    </section>
                  ) : (
                    <Empty title="You’re all caught up." text="New account and competition updates will appear here." />
                  )}
                </>
              )}

              {initialView === "profile" && (
                <PlayerProfile
                  user={user}
                  loading={!data}
                  boards={boards}
                  completed={completed}
                  level={level}
                  progress={levelProgress(completed, level)}
                  tokens={tokens}
                  onUser={acceptUser}
                  onLogout={logout}
                />
              )}

              {initialView === "edit-profile" && (
                <EditProfile user={user} loading={!data} onUser={acceptUser} />
              )}

              {initialView === "create" && (
                <>
                  <div className="play-home-heading">
                    <h1>Launch.</h1>
                  </div>
                  <p className="subheading create-subheading">Upload your artwork. Set the rules. Open registration today.</p>
                  <LiveCreate
                    user={user}
                    artist={String(user?.user_metadata.name || user?.user_metadata.username || "Ryvo creator")}
                    onLaunched={() => setRetry(value => value + 1)}
                  />
                </>
              )}

              {initialView === "referrals" && (
                <ReferralsPage
                  username={user?.user_metadata.username ?? ""}
                  level={level}
                  players={players}
                  scheme={scheme}
                  onUser={acceptUser}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function Empty({ title, text, href, label }: { title: string; text: string; href?: string; label?: string }) {
  return (
    <section className="empty-state live-empty">
      <Icon name="boards" size={30} />
      <h2>{title}</h2>
      <p>{text}</p>
      {href && (
        <Link className="primary" href={href}>
          {label}
          <Icon name="arrow" size={18} />
        </Link>
      )}
    </section>
  );
}
