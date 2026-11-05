"use client";

import { useEffect, useRef } from "react";

/** Camera QR scan of the buyer's delivery code (html5-qrcode). Typing the 6 words is always available too. */
export default function Scanner({ onCode, onClose }: { onCode: (text: string) => void; onClose: () => void }) {
  const done = useRef(false);
  useEffect(() => {
    let scanner: { clear: () => Promise<void> } | null = null;
    let cancelled = false;
    import("html5-qrcode").then(({ Html5QrcodeScanner }) => {
      if (cancelled) return;
      const s = new Html5QrcodeScanner("pop-qr-reader", { fps: 10, qrbox: 240 }, false);
      scanner = s;
      s.render(
        (text) => {
          if (done.current) return;
          done.current = true;
          onCode(text);
          s.clear().catch(() => {});
        },
        () => {},
      );
    });
    return () => {
      cancelled = true;
      scanner?.clear().catch(() => {});
    };
  }, [onCode]);
  return (
    <div className="space-y-2 rounded-xl border p-3">
      <div id="pop-qr-reader" />
      <button onClick={onClose} className="text-xs underline">close camera</button>
    </div>
  );
}
