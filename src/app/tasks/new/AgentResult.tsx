import styles from "./agent-result.module.css";

type AgentResultProps = {
  answer: string;
};

function resultParts(answer: string) {
  const lines = answer
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const chunks = lines.flatMap((line) => {
    const sentences = line.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [line];

    return sentences.flatMap((sentence) =>
      sentence
        .trim()
        .split(/(?<=;)\s+(?=[A-Z0-9])/)
        .map((part) => part.trim())
        .filter(Boolean)
    );
  });

  if (chunks.length <= 1) {
    return {
      lead: chunks[0] ?? answer.trim(),
      details: [] as string[],
    };
  }

  return {
    lead: chunks[0],
    details: chunks.slice(1),
  };
}

export default function AgentResult({ answer }: AgentResultProps) {
  const { lead, details } = resultParts(answer);

  return (
    <section className={styles.card}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>AGENT RESULT</span>
          <h3>Recommendation</h3>
        </div>
        <span className={styles.completeBadge}>COMPLETE</span>
      </div>

      <p className={styles.lead}>{lead}</p>

      {details.length > 0 ? (
        <div className={styles.details}>
          <span className={styles.detailsLabel}>Key points</span>
          <ul>
            {details.map((detail, index) => (
              <li key={`${detail}-${index}`}>{detail}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
