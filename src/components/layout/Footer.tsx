export default function Footer() {
  return (
    <footer className="border-t">
      <div className="container py-4">
        <p className="text-center text-sm text-muted-foreground">
          Dir gefällt Saiko?{" "}
          <a
            href="https://buymeacoffee.com/randomdailychallenge"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:underline"
          >
            Gib mir ein Bier aus!
          </a>{" "}
          <span className="text-foreground">❤️</span>
        </p>
      </div>
    </footer>
  );
}
