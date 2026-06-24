import { useState } from 'react'
import { Eye, EyeOff, Save, ShieldAlert, ExternalLink } from 'lucide-react'
import { Panel, Button, TextInput, Select } from '@/components/ui'
import { useAppStore } from '@/lib/store'
import { DELTA_BASE_URL } from '@/lib/deltaApi'

export default function SettingsPage() {
  const settings = useAppStore((s) => s.settings)
  const updateSettings = useAppStore((s) => s.updateSettings)

  const [apiKey, setApiKey] = useState(settings.credentials?.apiKey ?? '')
  const [apiSecret, setApiSecret] = useState(settings.credentials?.apiSecret ?? '')
  const [showSecret, setShowSecret] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSaveCreds = () => {
    updateSettings({
      credentials: apiKey && apiSecret ? { apiKey, apiSecret, baseUrl: DELTA_BASE_URL } : null,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClearCreds = () => {
    setApiKey('')
    setApiSecret('')
    updateSettings({ credentials: null })
  }

  return (
    <div className="h-full overflow-y-auto p-6 scrollbar-thin">
      <div className="mx-auto max-w-2xl space-y-5">
        <Panel title="Delta Exchange India API" subtitle="HMAC-SHA256 authenticated — api-key, timestamp, signature headers">
          <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-warn/10 px-3.5 py-3 text-[12px] text-warn ring-1 ring-warn/25">
            <ShieldAlert size={16} className="mt-0.5 shrink-0" />
            <div>
              Delta's own docs say to never include your API secret in client-side code — this app does so anyway, since it has
              no backend server. Keys are stored only in this browser's local storage and used to sign requests directly from
              your machine. Only run this on localhost or a private deployment only you can reach — never on a public URL with
              real keys typed in. When creating the key on Delta, leave "Trading" unchecked until you've paper-traded
              successfully, and whitelist your IP if you can.{' '}
              <a
                href="https://www.delta.exchange/app/account/manageapikeys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 underline"
              >
                Manage API Keys <ExternalLink size={11} />
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-dim">API Key</label>
              <TextInput value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your Delta Exchange API key" />
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-dim">API Secret</label>
              <div className="relative">
                <TextInput
                  type={showSecret ? 'text' : 'password'}
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Paste your Delta Exchange API secret"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                >
                  {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-dim">Base URL</label>
              <TextInput value={DELTA_BASE_URL} disabled />
            </div>

            <div className="flex gap-2.5">
              <Button variant="primary" onClick={handleSaveCreds}>
                <Save size={14} /> {saved ? 'Saved!' : 'Save Credentials'}
              </Button>
              <Button variant="ghost" onClick={handleClearCreds}>
                Clear
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title="Bot Defaults">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-dim">Default Symbol</label>
              <Select value={settings.defaultSymbol} onChange={(e) => updateSettings({ defaultSymbol: e.target.value })}>
                <option value="BTCUSD">BTCUSD</option>
                <option value="ETHUSD">ETHUSD</option>
                <option value="SOLUSD">SOLUSD</option>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-dim">Default Resolution</label>
              <Select value={settings.defaultResolution} onChange={(e) => updateSettings({ defaultResolution: e.target.value })}>
                <option value="1m">1m</option>
                <option value="5m">5m</option>
                <option value="15m">15m</option>
                <option value="1h">1h</option>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-[12px] font-medium text-ink-dim">Poll Interval (seconds)</label>
              <TextInput
                type="number"
                min={10}
                value={settings.pollIntervalSec}
                onChange={(e) => updateSettings({ pollIntervalSec: parseInt(e.target.value) || 30 })}
              />
            </div>
          </div>
        </Panel>

        <Panel title="About">
          <p className="text-[12.5px] text-ink-dim">
            This bot runs entirely in your browser. Indicator code executes client-side in a restricted sandbox — never paste in
            code from someone you don't trust. Paper trading places no real orders; live trading places real market orders with
            real funds on your Delta Exchange India account.
          </p>
        </Panel>
      </div>
    </div>
  )
}
