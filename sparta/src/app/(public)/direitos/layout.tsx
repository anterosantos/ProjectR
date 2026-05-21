export default function DireitosLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex flex-col min-h-screen">
      <main id="main-content" className="flex-1">
        {children}
      </main>
    </div>
  )
}
