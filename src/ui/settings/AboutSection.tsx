// The version, and what Bodycap does and doesn't do with your data.
export function AboutSection() {
  return (
    <section
      aria-labelledby="about-title"
      className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:p-6"
    >
      <h2 id="about-title" className="text-base font-semibold">
        About
      </h2>
      <p>Version {__APP_VERSION__}</p>
      <p className="max-w-prose text-muted-foreground">
        Bodycap keeps everything in this browser. Nothing is sent anywhere: there are no accounts,
        no analytics, and no tracking. It works offline, and it's free software under the MIT
        licence.
      </p>
    </section>
  )
}
