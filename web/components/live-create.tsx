"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Artwork, Icon, storedArtworkUrl } from "@/components/collection-art";
import { SolanaProvider } from "@/components/solana-provider";
import { WalletConnectOptions } from "@/components/wallet-page";
import { payCompetition, stageLabel, type PayStage } from "@/lib/competition-pay";
import { fragmentLayout, money, type Competition } from "@/lib/demo";
import { shortAddress } from "@/lib/solana-config";
import { supabase } from "@/lib/supabase";

const FEES = [500, 1000, 2000];
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type Image = { path: string; preview: string };
type Mine = { id: string; definition: Competition; created_at: string };

/* An unfinished launch is saved per account, so leaving the app never loses it. */
type Draft = {
  step: number; title: string; story: string; total: number; capacity: number; winners: number; fee: number; share: 5 | 10;
  artworkPath: string | null; coverPath: string | null; competitionId: string; savedAt: number;
};
const DRAFT_TTL = 7 * 24 * 60 * 60 * 1000;
const draftKey = (uid: string) => `ryvo-create-draft:${uid}`;
function readDraft(uid: string | undefined): Draft | null {
  if (!uid || typeof window === "undefined") return null;
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey(uid)) || "null") as Draft | null;
    return draft && Date.now() - draft.savedAt < DRAFT_TTL && /^custom-[a-f0-9-]{36}$/.test(draft.competitionId) ? draft : null;
  } catch {
    return null;
  }
}
const clearDraft = (uid: string) => { try { localStorage.removeItem(draftKey(uid)); } catch { /* storage blocked */ } };
const restoredImage = (path: string | null | undefined): Image | null => (path ? { path, preview: storedArtworkUrl(path) } : null);

export function LiveCreate({ user, artist, onLaunched }: { user: User | null; artist: string; onLaunched: () => void }) {
  return (
    <SolanaProvider>
      {/* Remount per account so the saved draft loads into the initial state. */}
      <CreateFlow key={user?.id ?? "signed-out"} user={user} artist={artist} onLaunched={onLaunched} />
    </SolanaProvider>
  );
}

function CreateFlow({ user, artist, onLaunched }: { user: User | null; artist: string; onLaunched: () => void }) {
  const { publicKey, signTransaction, connected } = useWallet();
  const [saved] = useState(() => readDraft(user?.id));
  const [step, setStep] = useState(() => Math.min(2, Math.max(0, saved?.step ?? 0)));
  const [artwork, setArtwork] = useState<Image | null>(() => restoredImage(saved?.artworkPath));
  const [cover, setCover] = useState<Image | null>(() => restoredImage(saved?.coverPath));
  const [uploading, setUploading] = useState<"" | "artwork" | "cover">("");
  const [title, setTitle] = useState(saved?.title ?? "");
  const [story, setStory] = useState(saved?.story ?? "");
  const [total, setTotal] = useState(saved?.total ?? 12);
  const [capacity, setCapacity] = useState(saved?.capacity ?? 100);
  const [winners, setWinners] = useState(saved?.winners ?? 10);
  const [fee, setFee] = useState(saved?.fee ?? 1000);
  const [share, setShare] = useState<5 | 10>(saved?.share ?? 5);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<PayStage | null>(null);
  const [launched, setLaunched] = useState<string | null>(null);
  const [competitionId, setCompetitionId] = useState(() => saved?.competitionId ?? `custom-${crypto.randomUUID()}`);
  const [copied, setCopied] = useState(false);
  const mine = useMine(user, launched);
  // A launch paid while the app was in the background shows as done on return.
  const done = launched ?? (mine.some((m) => m.id === competitionId) ? competitionId : null);

  useEffect(() => {
    if (!user) return;
    if (done) { clearDraft(user.id); return; }
    if (!artwork && !title && !story) return;
    const draft: Draft = { step, title, story, total, capacity, winners, fee, share, artworkPath: artwork?.path ?? null, coverPath: cover?.path ?? null, competitionId, savedAt: Date.now() };
    try { localStorage.setItem(draftKey(user.id), JSON.stringify(draft)); } catch { /* storage full or blocked */ }
  }, [user, done, step, title, story, total, capacity, winners, fee, share, artwork, cover, competitionId]);

  const projected = fee * capacity;
  const launchFee = Math.max(1, Math.round((projected * share) / 200));
  const prize = Math.round(projected * 0.2);
  const creatorEarnings = Math.round((projected * share) / 100);
  const layout = useMemo(() => fragmentLayout(total), [total]);

  async function upload(file: File | undefined, kind: "artwork" | "cover") {
    if (!file || !user) return;
    setError("");
    const ext = TYPES[file.type];
    if (!ext) return setError("Use a JPG, PNG or WebP image.");
    if (file.size > MAX_BYTES) return setError("Images can be up to 8 MB.");
    setUploading(kind);
    try {
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase().storage.from("competition-art").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const image = { path, preview: URL.createObjectURL(file) };
      if (kind === "artwork") setArtwork(image); else setCover(image);
    } catch {
      setError("That image could not be uploaded. Check your connection and try again.");
    } finally {
      setUploading("");
    }
  }

  function next() {
    setError("");
    if (step === 0 && (!artwork || title.trim().length < 3 || story.trim().length < 20)) {
      return setError("Add your artwork, a title of at least 3 characters and a story of at least 20.");
    }
    if (step === 1 && (capacity < 2 || capacity > 10000 || winners < 1 || winners > capacity)) {
      return setError("Use 2–10,000 players and between 1 and that many winner slots.");
    }
    setStep(step + 1);
  }

  async function launch() {
    if (!publicKey || !signTransaction || !artwork) return;
    setError("");
    try {
      const result = await payCompetition(
        {
          kind: "launch", competitionId,
          draft: { title: title.trim(), description: story.trim(), artist, fee, capacity, winners, creatorShare: share, total, artworkPath: artwork.path, coverPath: (cover ?? artwork).path },
        },
        { publicKey, signTransaction },
        setStage,
      );
      if (result.status === "paid") { setLaunched(result.competitionId); onLaunched(); }
    } catch (e) {
      setError(e instanceof Error ? e.message : "The launch could not be completed.");
    } finally {
      setStage(null);
    }
  }

  function reset() {
    if (user) clearDraft(user.id);
    setLaunched(null); setStep(0); setArtwork(null); setCover(null); setTitle(""); setStory(""); setCopied(false);
    setCompetitionId(`custom-${crypto.randomUUID()}`);
  }

  if (!user) {
    return (
      <section className="lc-gate">
        <span className="lc-gate-icon" aria-hidden="true"><Icon name="spark" size={26} /></span>
        <h2>Turn your art into the next challenge.</h2>
        <p>Sign in to upload artwork, set the rules and launch a competition players can join with USDC.</p>
        <Link className="primary" href="/signin?next=/create">Sign in to create <Icon name="arrow" /></Link>
      </section>
    );
  }

  if (done) {
    const launchedDef = mine.find((m) => m.id === done)?.definition;
    const link = `${typeof window === "undefined" ? "" : window.location.origin}/collection/${done}`;
    return (
      <section className="lc-success" aria-live="polite">
        <span className="lc-success-icon" aria-hidden="true"><Icon name="check" size={30} /></span>
        <p className="eyebrow">LAUNCH FEE PAID</p>
        <h2>{launchedDef?.title ?? title} is open to join.</h2>
        <p>Share it with your community. The one-month round starts when all {(launchedDef?.capacity ?? capacity).toLocaleString()} places are filled.</p>
        <div className="lc-success-actions">
          <Link className="primary" href={`/collection/${done}`}>View competition <Icon name="arrow" /></Link>
          <button className="lc-ghost" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { /* blocked */ } }}>{copied ? "Link copied" : "Copy link"}</button>
          <button className="lc-ghost" onClick={reset}>Create another</button>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="lc-layout">
        <section className="lc-editor" aria-labelledby="lc-step-title">
          <ol className="lc-steps" aria-label="Launch progress">
            {["Artwork", "Rules", "Review"].map((label, i) => (
              <li key={label} className={step === i ? "is-current" : step > i ? "is-done" : ""} aria-current={step === i ? "step" : undefined}>
                <span>{step > i ? <Icon name="check" size={14} /> : i + 1}</span>{label}
              </li>
            ))}
          </ol>

          {step === 0 && (
            <div className="lc-form">
              <h2 id="lc-step-title">Start with your artwork.</h2>
              <p className="lc-hint">It becomes the board players race to complete.</p>
              <div className="lc-uploads">
                <UploadTile label="Artwork" note="Split into the pieces players collect" image={artwork} busy={uploading === "artwork"} onFile={(f) => void upload(f, "artwork")} disabled={!!uploading} />
                <UploadTile label="Cover · optional" note="Shown on competition cards. Defaults to your artwork." image={cover} busy={uploading === "cover"} onFile={(f) => void upload(f, "cover")} disabled={!!uploading} />
              </div>
              <label className="lc-field">Title<input maxLength={70} placeholder="Give your challenge a name" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
              <label className="lc-field">The story<textarea maxLength={1200} rows={4} placeholder="Introduce the artwork and what makes this challenge worth playing…" value={story} onChange={(e) => setStory(e.target.value)} /><small>{story.trim().length < 20 ? `${20 - story.trim().length} more characters needed` : `${story.length} / 1,200`}</small></label>
            </div>
          )}

          {step === 1 && (
            <div className="lc-form">
              <h2 id="lc-step-title">Set the rules.</h2>
              <p className="lc-hint">You can’t change these after launch.</p>
              <label className="lc-field">
                <span className="lc-field-row">Pieces<b>{total}</b></span>
                <input type="range" min={10} max={50} step={1} value={total} onChange={(e) => setTotal(Number(e.target.value))} aria-label="Number of pieces" />
                <small>More pieces make a longer race.</small>
              </label>
              <div className="lc-pair">
                <label className="lc-field">Players<input type="number" inputMode="numeric" min={2} max={10000} value={capacity} onChange={(e) => { const next = Math.max(0, Math.floor(Number(e.target.value))); setCapacity(next); if (winners > next) setWinners(Math.max(1, next)); }} /></label>
                <label className="lc-field">Winner slots<input type="number" inputMode="numeric" min={1} max={capacity} value={winners} onChange={(e) => setWinners(Math.max(0, Math.floor(Number(e.target.value))))} /></label>
              </div>
              <fieldset className="lc-choice">
                <legend>Entry fee</legend>
                {FEES.map((v) => (
                  <label key={v} className={fee === v ? "is-on" : ""}><input type="radio" name="fee" checked={fee === v} onChange={() => setFee(v)} /><b>{money(v)}</b><span>{(v * 10).toLocaleString()} r/</span></label>
                ))}
              </fieldset>
              <fieldset className="lc-choice">
                <legend>Your creator share</legend>
                {([5, 10] as const).map((v) => (
                  <label key={v} className={share === v ? "is-on" : ""}><input type="radio" name="share" checked={share === v} onChange={() => setShare(v)} /><b>{v}% of entries</b><span>{v / 2}% launch fee</span></label>
                ))}
              </fieldset>
              <p className="lc-note"><Icon name="time" size={18} /> The one-month round starts only when every place is filled.</p>
            </div>
          )}

          {step === 2 && (
            <div className="lc-form">
              <h2 id="lc-step-title">Review and launch.</h2>
              <p className="lc-hint">Players can join as soon as your launch fee is confirmed.</p>
              <dl className="lc-summary">
                <div><dt>Entry fee</dt><dd>{money(fee)} <small>· {(fee * 10).toLocaleString()} r/ issued</small></dd></div>
                <div><dt>Players · winners</dt><dd>{capacity.toLocaleString()} · {winners.toLocaleString()}</dd></div>
                <div><dt>Projected entries</dt><dd>{money(projected)}</dd></div>
                <div><dt>Prize pool · 20%</dt><dd>{money(prize)}</dd></div>
                <div><dt>Your share · {share}%</dt><dd>{money(creatorEarnings)}</dd></div>
                <div className="is-total"><dt>Launch fee today</dt><dd>{money(launchFee)} <small>USDC</small></dd></div>
              </dl>
              <div className="lc-pay">
                {connected && publicKey ? (
                  <p className="lc-pay-wallet"><span aria-hidden="true" className="lc-dot" />Paying from {shortAddress(publicKey.toBase58())}</p>
                ) : (
                  <>
                    <p className="lc-pay-title">Connect the wallet you’ll pay from</p>
                    <WalletConnectOptions />
                  </>
                )}
              </div>
            </div>
          )}

          {error && <p className="lc-error" role="alert">{error}</p>}
          <div className="lc-actions">
            {step > 0 && <button className="lc-ghost" onClick={() => { setError(""); setStep(step - 1); }} disabled={!!stage}>Back</button>}
            {step < 2 ? (
              <button className="primary" onClick={next} disabled={!!uploading}>Continue <Icon name="arrow" /></button>
            ) : (
              <button className="primary" onClick={() => void launch()} disabled={!connected || !signTransaction || !!stage}>
                {stage ? stageLabel(stage) : `Pay ${money(launchFee)} & launch`} {!stage && <Icon name="arrow" />}
              </button>
            )}
          </div>
        </section>

        <aside className="lc-preview" aria-label="Board preview">
          <div className="lc-board">
            {artwork ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artwork.preview} alt="" />
            ) : (
              <Artwork theme="explorer" />
            )}
            <div className="lc-grid" aria-hidden="true">
              {layout.map((f, i) => (
                <span key={i} style={{ left: `${f.x * 100}%`, top: `${f.y * 100}%`, width: `${f.width * 100}%`, height: `${f.height * 100}%` }} />
              ))}
            </div>
          </div>
          <div className="lc-preview-copy">
            <b>{title.trim() || "Your next challenge"}</b>
            <span>by {artist} · {total} pieces</span>
          </div>
          <div className="lc-preview-facts">
            <span><small>Entry</small>{money(fee)}</span>
            <span><small>Players</small>{capacity.toLocaleString()}</span>
            <span><small>Prize pool</small>{money(prize)}</span>
          </div>
        </aside>
      </div>

      {mine.length > 0 && (
        <section className="lc-mine" aria-labelledby="lc-mine-title">
          <h2 id="lc-mine-title">Your competitions</h2>
          <div className="lc-mine-rows">
            {mine.map(({ id, definition: c }) => (
              <Link key={id} className="lc-mine-row" href={`/collection/${id}`}>
                <span className="lc-mine-art"><Artwork theme={c.theme} /></span>
                <span className="lc-mine-copy"><b>{c.title}</b><span>{c.joined.toLocaleString()} / {c.capacity.toLocaleString()} joined · {money(c.fee)} entry</span></span>
                <span className={`lc-status is-${c.status}`}>{c.status === "open" ? "Open" : c.status === "active" ? "Live" : "Ended"}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function UploadTile({ label, note, image, busy, disabled, onFile }: { label: string; note: string; image: Image | null; busy: boolean; disabled: boolean; onFile: (f: File | undefined) => void }) {
  return (
    <label className={`lc-upload${image ? " has-image" : ""}${busy ? " is-busy" : ""}`}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.preview} alt="" />
      ) : (
        <span className="lc-upload-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="24" height="24"><path d="M12 16V5m0 0-4 4m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
      )}
      <span className="lc-upload-copy"><b>{busy ? "Uploading…" : image ? `Change ${label.split(" ")[0].toLowerCase()}` : label}</b><small>{note}</small></span>
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} aria-label={`Upload ${label}`} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
    </label>
  );
}

/** The signed-in creator's own competitions, newest first. */
function useMine(user: User | null, refreshKey: string | null) {
  const [rows, setRows] = useState<Mine[]>([]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    supabase().from("competitions").select("id,definition,created_at").eq("creator_id", user.id).order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => { if (active && data) setRows(data as Mine[]); });
    return () => { active = false; };
  }, [user, refreshKey]);
  return rows;
}
