"use client";

import QRCode from "qrcode";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { getRetryDelaySeconds, type LiveSnapshot } from "../lib/attendance/live-state";

interface Challenge {
  token: string;
  expiresAt: string;
  serverTime: string;
}

interface LiveProjectorProps {
  sessionId: string;
}

const POLL_MILLISECONDS = 1_000;
const CHALLENGE_REFRESH_MILLISECONDS = 25_000;

export function LiveProjector({ sessionId }: LiveProjectorProps) {
  const [snapshot, setSnapshot] = useState<LiveSnapshot | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [serverNow, setServerNow] = useState<number | null>(null);
  const snapshotRef = useRef<LiveSnapshot | null>(null);
  const clockOffsetRef = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setServerNow(Date.now() + clockOffsetRef.current);
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    let pollTimer: number | undefined;
    let challengeTimer: number | undefined;
    let failures = 0;
    let challengeStarted = false;

    function serverNow() {
      return Date.now() + clockOffsetRef.current;
    }

    function isOpen(current: LiveSnapshot | null) {
      return Boolean(
        current?.state === "open" &&
          current.checkinEndsAt &&
          serverNow() < Date.parse(current.checkinEndsAt),
      );
    }

    async function rotateChallenge() {
      if (!active || !isOpen(snapshotRef.current)) {
        return;
      }
      try {
        const response = await fetch(`/api/class-sessions/${sessionId}/challenge`, {
          method: "POST",
        });
        if (!response.ok) {
          throw new Error("Challenge request failed");
        }
        const incoming = (await response.json()) as Challenge;
        if (!active || !isOpen(snapshotRef.current)) {
          return;
        }
        clockOffsetRef.current = Date.parse(incoming.serverTime) - Date.now();
        setServerNow(Date.parse(incoming.serverTime));
        const image = await QRCode.toDataURL(
          `${window.location.origin}/check-in#token=${incoming.token}`,
          { width: 560, margin: 2, errorCorrectionLevel: "M" },
        );
        if (active && isOpen(snapshotRef.current)) {
          setChallenge(incoming);
          setQrImage(image);
        }
      } catch {
        if (active) {
          setChallenge(null);
          setQrImage(null);
        }
      }
      if (active && isOpen(snapshotRef.current)) {
        challengeTimer = window.setTimeout(
          rotateChallenge,
          CHALLENGE_REFRESH_MILLISECONDS,
        );
      }
    }

    async function loadSnapshot() {
      try {
        const response = await fetch(`/api/class-sessions/${sessionId}/live`, {
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error("Live request failed");
        }
        const incoming = (await response.json()) as LiveSnapshot;
        if (!active) {
          return;
        }
        clockOffsetRef.current = Date.parse(incoming.serverTime) - Date.now();
        setServerNow(Date.parse(incoming.serverTime));
        snapshotRef.current = incoming;
        setSnapshot(incoming);
        setStale(false);
        setLoadError(false);
        failures = 0;

        if (incoming.state === "open") {
          if (!challengeStarted && isOpen(incoming)) {
            challengeStarted = true;
            void rotateChallenge();
          }
          pollTimer = window.setTimeout(loadSnapshot, POLL_MILLISECONDS);
        } else if (incoming.state === "closed" || incoming.state === "cancelled") {
          if (challengeTimer !== undefined) {
            window.clearTimeout(challengeTimer);
          }
          setChallenge(null);
          setQrImage(null);
        } else {
          pollTimer = window.setTimeout(loadSnapshot, POLL_MILLISECONDS);
        }
      } catch {
        if (!active) {
          return;
        }
        failures += 1;
        setStale(Boolean(snapshotRef.current));
        setLoadError(!snapshotRef.current);
        pollTimer = window.setTimeout(
          loadSnapshot,
          getRetryDelaySeconds(failures) * 1_000,
        );
      }
    }

    void loadSnapshot();
    return () => {
      active = false;
      if (pollTimer !== undefined) {
        window.clearTimeout(pollTimer);
      }
      if (challengeTimer !== undefined) {
        window.clearTimeout(challengeTimer);
      }
    };
  }, [sessionId]);

  const now = serverNow ?? 0;
  const deadline = snapshot?.checkinEndsAt ? Date.parse(snapshot.checkinEndsAt) : 0;
  const remainingSeconds = snapshot?.state === "open"
    ? Math.max(0, Math.ceil((deadline - now) / 1_000))
    : 0;
  const qrDeadline = challenge
    ? Math.min(Date.parse(challenge.expiresAt), deadline)
    : 0;
  const showQr = Boolean(
    snapshot?.state === "open" && challenge && qrImage && now < qrDeadline,
  );
  const unconfirmedClose = Boolean(
    snapshot?.state === "open" && stale && deadline > 0 && now >= deadline,
  );
  const countdown = useMemo(() => {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }, [remainingSeconds]);

  return (
    <main className="projector-shell" id="permbajtja-kryesore">
      <section className="projector-qr" aria-labelledby="projector-title">
        <p className="eyebrow">Vijueshmëria live</p>
        <h1 id="projector-title">Check-in</h1>
        <div className="projector-countdown" aria-label="Koha e mbetur">
          {countdown}
        </div>
        {showQr ? (
          <Image
            className="projector-qr-image"
            src={qrImage ?? ""}
            alt="QR për check-in"
            width={560}
            height={560}
            priority
            unoptimized
          />
        ) : (
          <div className="projector-qr-placeholder" aria-live="polite">
            {snapshot?.state === "closed" || snapshot?.state === "cancelled"
              ? "Check-in u mbyll"
              : snapshot?.state === "draft"
                ? "Në pritje që sesioni të hapet"
              : remainingSeconds === 0 && snapshot
                ? "Afati për check-in përfundoi"
                : "Duke përgatitur QR-në…"}
          </div>
        )}
        <p className="projector-guidance">
          Mos e shpërndani QR-në. Çdo hyrje shfaqet live dhe regjistrohet me kohën e serverit.
        </p>
      </section>

      <section className="projector-roster" aria-labelledby="attendance-list-title">
        <div className="projector-list-heading">
          <h2 id="attendance-list-title">Të pranishëm</h2>
          {!unconfirmedClose ? (
            <p className="projector-total">Gjithsej <strong>{snapshot?.total ?? 0}</strong></p>
          ) : null}
        </div>
        {stale ? <p className="stale-label" role="status">të dhënat mund të jenë të vjetruara</p> : null}
        {unconfirmedClose ? (
          <p className="unconfirmed-close" role="alert">
            Check-in u mbyll — rilidhu për totalin
          </p>
        ) : null}
        {loadError ? <p role="alert">Nuk mund të ngarkohen të dhënat live.</p> : null}
        <ol className={stale ? "projector-list is-stale" : "projector-list"}>
          {snapshot?.entries.map((entry) => (
            <li key={entry.rosterId}>
              <strong>{entry.displayName}</strong>
              <time dateTime={entry.recordedAt}>
                {new Intl.DateTimeFormat("sq-AL", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }).format(new Date(entry.recordedAt))}
              </time>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
