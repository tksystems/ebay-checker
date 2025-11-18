import Link from "next/link";

const features = [
  {
    icon: "⏱️",
    title: "リアルタイム監視",
    description: "1時間ごとに価格・在庫を自動チェックし、変化をすぐに検知",
  },
  {
    icon: "🔔",
    title: "賢いアラート",
    description: "しきい値や在庫復活をトリガーに通知。Slackやメールに送信",
  },
  {
    icon: "📈",
    title: "詳細レポート",
    description: "価格トレンド、売れ行き、出品者状況をまとめて可視化",
  },
  {
    icon: "🤝",
    title: "チーム共有",
    description: "監視リストや結果をチーム全員でリアルタイム共有",
  },
];

const steps = [
  {
    label: "STEP 1",
    title: "商品を登録",
    description: "URLを貼り付けるだけで監視リストに追加",
  },
  {
    label: "STEP 2",
    title: "条件をセット",
    description: "ターゲット価格や通知ルールを細かく設定",
  },
  {
    label: "STEP 3",
    title: "結果を受け取る",
    description: "変動があれば即座に通知。最適な購入タイミングを逃さない",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-900 text-white">
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-x-0 top-[-10rem] -z-10 transform-gpu blur-3xl">
          <div className="mx-auto aspect-square w-[60vw] bg-gradient-to-r from-blue-500/40 via-indigo-400/40 to-fuchsia-500/40 opacity-70" />
        </div>

        <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-16 pt-10 md:px-12 lg:px-16">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-blue-200">smart monitor</p>
              <span className="text-2xl font-semibold">eBay Checker</span>
            </div>
            <div className="hidden items-center gap-4 text-sm font-medium md:flex">
              <Link href="/stores" className="text-slate-200 transition hover:text-white">
                監視中のストア
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-white/30 px-5 py-2 text-white transition hover:border-white hover:bg-white/10"
              >
                ログイン
              </Link>
            </div>
          </header>

          <div className="mt-16 grid gap-12 md:grid-cols-[1.05fr_0.95fr] md:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1 text-xs uppercase tracking-[0.2em] text-blue-100">
                eBay seller toolkit
                <span className="rounded-full bg-green-400/20 px-2 py-0.5 text-[10px] font-semibold text-green-200">
                  Beta 2.0
                </span>
              </p>
              <h1 className="mt-6 text-4xl font-bold leading-tight text-white md:text-5xl">
                価格変動も在庫の気配も、<br className="hidden md:block" />
                eBay Checkerがすべて捕捉
              </h1>
              <p className="mt-6 text-lg text-slate-200 md:text-xl">
                面倒なリスト監視を完全自動化。登録された通知先がなるのを待つだけ。
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href="/login"
                  className="rounded-full border border-white/30 px-7 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:border-white hover:bg-white/10"
                >
                  ログイン
                </Link>
              </div>

            </div>

            <div className="relative">
              <div className="absolute inset-0 -translate-y-6 translate-x-6 rounded-3xl bg-blue-500/20 blur-3xl" />
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
                <div className="flex items-center justify-between text-xs uppercase text-slate-300">
                  <span className="tracking-[0.3em]">market watch</span>
                  <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-emerald-100">live</span>
                </div>
                <div className="mt-6 space-y-4 text-sm text-slate-100">
                  <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                    <div>
                      <p className="font-semibold">PS5 Limited Bundle</p>
                      <p className="text-xs text-slate-300">価格 -4.2% / 在庫 ◉</p>
                    </div>
                    <p className="text-emerald-300">$468 → $448</p>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                    <div>
                      <p className="font-semibold">LEGO Icons #10320</p>
                      <p className="text-xs text-slate-300">出品数 +8 / 24h</p>
                    </div>
                    <p className="text-blue-200">Watch</p>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
                    <div>
                      <p className="font-semibold">Vintage Camera Lot</p>
                      <p className="text-xs text-slate-300">最新検知 12分前</p>
                    </div>
                    <p className="text-amber-200">Alert sent</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section className="mt-24">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-blue-200">features</p>
                <h2 className="mt-2 text-3xl font-semibold">バイヤーの意思決定を加速する装備</h2>
              </div>
              <Link href="/stores" className="text-sm text-blue-200 underline-offset-4 hover:underline">
                すべての機能を見る →
              </Link>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/30"
                >
                  <div className="text-3xl">{feature.icon}</div>
                  <h3 className="mt-4 text-xl font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-slate-200">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-24 grid gap-8 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent p-8 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.title} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-200">{step.label}</p>
                <h3 className="text-2xl font-semibold">{step.title}</h3>
                <p className="text-sm text-slate-200">{step.description}</p>
              </div>
            ))}
          </section>

          <section className="mt-24 rounded-3xl border border-white/10 bg-gradient-to-r from-blue-600/80 via-blue-500/70 to-violet-600/70 p-10 text-center shadow-xl shadow-blue-700/25">
            <p className="text-xs uppercase tracking-[0.4em] text-blue-100">start today</p>
            <h2 className="mt-4 text-3xl font-semibold">3分でセットアップ完了</h2>
            <p className="mt-3 text-slate-100">
              まずは主要商品の監視から始めて、結果を体感してください。
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Link
                href="/login"
                className="rounded-full border border-white/80 px-8 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-white/10"
              >
                既存アカウントでログイン
              </Link>
            </div>
          </section>

          <footer className="mt-16 border-t border-white/10 pt-8 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} eBay Checker. Monitor smarter, source faster.
          </footer>
        </div>
      </div>
    </div>
  );
}
