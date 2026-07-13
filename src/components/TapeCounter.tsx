export default function TapeCounter({
  value,
  minDigits = 3,
}: {
  value: number;
  minDigits?: number;
}) {
  const digits = Math.max(minDigits, String(value).length);
  const str = String(value).padStart(digits, '0');

  return (
    <span className="tape-counter text-2xl md:text-3xl">
      {str.split('').map((d, i) => (
        <span className="digit" key={i}>
          {d}
        </span>
      ))}
    </span>
  );
}
