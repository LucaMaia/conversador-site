export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="text-sm text-danger-500">
      {message}
    </p>
  )
}
