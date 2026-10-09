// Saves text or a Blob as a file in the person's downloads, through a temporary object URL.
export function saveFile(name: string, contents: string | Blob, type: string): void {
  const blob = contents instanceof Blob ? contents : new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  // Some browsers start the download after click returns, so the URL is kept a moment longer
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}
