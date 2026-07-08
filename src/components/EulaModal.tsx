import React, { useState } from 'react';
import { ShieldCheck, ScrollText, CheckCircle2, X } from 'lucide-react';

interface EulaModalProps {
  onAccept: () => void;
}

export default function EulaModal({ onAccept }: EulaModalProps) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const [checked, setChecked] = useState(false);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
      setScrolledToEnd(true);
    }
  };

  const canAccept = scrolledToEnd && checked;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-container w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-outline-variant overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-outline-variant bg-primary-container">
          <ShieldCheck className="text-primary w-7 h-7 shrink-0" />
          <div>
            <h2 className="text-lg font-bold text-on-primary-container">License Agreement</h2>
            <p className="text-xs text-on-primary-container/70 mt-0.5">
              EduAdmin Pro — Copyright &copy; 2026 Kenneth Donkor-Tutu
            </p>
          </div>
        </div>

        {/* Terms body — scrollable */}
        <div
          className="flex-1 overflow-y-auto px-6 py-5 text-sm text-on-surface-variant space-y-4 min-h-0"
          onScroll={handleScroll}
        >
          <section>
            <h3 className="font-semibold text-on-surface mb-1 flex items-center gap-2">
              <ScrollText className="w-4 h-4" /> Grant of Use
            </h3>
            <p>
              EduAdmin Pro ("Software") is licensed, not sold. Kenneth Donkor-Tutu
              ("Licensor") grants the educational institution that installs this Software
              ("School") a non-exclusive, non-transferable licence to install and use the
              Software solely for internal school administration purposes within Ghana.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-on-surface mb-1">Permitted Uses</h3>
            <ul className="list-disc ml-5 space-y-1">
              <li>Manage student records, attendance, and academic scores.</li>
              <li>Generate reports and print school documentation.</li>
              <li>Use the integrated AI assistant for data analysis within the Software.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-on-surface mb-1">Restrictions</h3>
            <ul className="list-disc ml-5 space-y-1">
              <li>You may not copy, distribute, sell, or sublicence the Software.</li>
              <li>You may not reverse-engineer, decompile, or modify the Software.</li>
              <li>You may not use the Software to store data unrelated to school administration.</li>
              <li>You may not remove or obscure any copyright, trademark, or proprietary notices.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-on-surface mb-1">Data & Privacy</h3>
            <p>
              All student and staff data is stored locally on the School's computer. No
              personal data is transmitted to external servers except when you explicitly
              enable AI features (which require a Google Gemini API key you supply) or
              WhatsApp notifications (which require a webhook URL you supply). The School
              is solely responsible for complying with applicable data protection laws,
              including Ghana's Data Protection Act 2012 (Act 843).
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-on-surface mb-1">Warranty Disclaimer</h3>
            <p>
              The Software is provided "as is" without warranty of any kind. The Licensor
              makes no warranties, express or implied, including but not limited to
              merchantability, fitness for a particular purpose, or non-infringement.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-on-surface mb-1">Limitation of Liability</h3>
            <p>
              To the maximum extent permitted by applicable law, the Licensor shall not be
              liable for any indirect, incidental, special, or consequential damages arising
              from use or inability to use the Software, including loss of data.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-on-surface mb-1">Governing Law</h3>
            <p>
              This Agreement is governed by the laws of the Republic of Ghana. Any dispute
              shall be resolved in the courts of competent jurisdiction in Ghana.
            </p>
          </section>

          <p className="text-xs text-on-surface-variant/60 pt-2 border-t border-outline-variant">
            Copyright &copy; 2026 Kenneth Donkor-Tutu. All rights reserved.<br />
            EduAdmin Pro v1.0.0 &mdash; School Management System
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline-variant bg-surface-container-low space-y-3">
          {!scrolledToEnd && (
            <p className="text-xs text-on-surface-variant/70 text-center">
              Scroll to the bottom to read the full agreement before accepting.
            </p>
          )}

          <label className={`flex items-start gap-3 cursor-pointer group ${!scrolledToEnd ? 'opacity-40 pointer-events-none' : ''}`}>
            <div
              className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                checked ? 'bg-primary border-primary' : 'border-outline group-hover:border-primary'
              }`}
              onClick={() => scrolledToEnd && setChecked(v => !v)}
            >
              {checked && <CheckCircle2 className="w-4 h-4 text-on-primary" />}
            </div>
            <span className="text-sm text-on-surface">
              I have read and agree to the EduAdmin Pro License Agreement on behalf of my school.
            </span>
          </label>

          <div className="flex gap-3 justify-end">
            <button
              className="px-4 py-2 text-sm rounded-lg text-on-surface-variant hover:bg-surface-variant transition-colors"
              onClick={() => {
                if (window.electron?.quit) window.electron.quit();
                else window.close();
              }}
            >
              Decline &amp; Exit
            </button>
            <button
              disabled={!canAccept}
              onClick={onAccept}
              className={`px-6 py-2 text-sm font-semibold rounded-lg transition-colors ${
                canAccept
                  ? 'bg-primary text-on-primary hover:bg-primary/90'
                  : 'bg-primary/30 text-on-primary/50 cursor-not-allowed'
              }`}
            >
              Accept &amp; Proceed
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
