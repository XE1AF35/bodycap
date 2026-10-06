// Saves text as a file in the person's downloads, through a temporary object URL.
export function saveFile(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  // Some browsers start the download after click returns, so the URL is kept a moment longer
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 1000)
}
