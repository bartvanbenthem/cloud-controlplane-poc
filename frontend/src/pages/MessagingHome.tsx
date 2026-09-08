import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function MessagingHome() {
  const [rabbitmqCount, setRabbitmqCount] = useState<number | null>(null);
  const [kafkaCount, setKafkaCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.list("rabbitmqclusters"), api.list("kafkaclusters")])
      .then(([r, k]) => {
        setRabbitmqCount(r.length);
        setKafkaCount(k.length);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <>
      <div className="page-header">
        <h2>Messaging</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Message queues and event streaming, via{" "}
        <a
          href="https://github.com/bartvanbenthem/project-easter"
          target="_blank"
          rel="noreferrer"
        >
          project-easter
        </a>
        .
      </p>
      {error && <div className="error-banner">{error}</div>}

      <div className="category-grid">
        <Link to="/messaging/rabbitmq" className="category-card">
          <h3>RabbitMQ</h3>
          <p className="muted">RabbitMQ Cluster Operator, via project-easter's RabbitMQCluster</p>
          <div className="category-stats">
            <span>{rabbitmqCount ?? "…"} brokers</span>
          </div>
        </Link>

        <Link to="/messaging/kafka" className="category-card">
          <h3>Kafka</h3>
          <p className="muted">Strimzi, via project-easter's KafkaCluster</p>
          <div className="category-stats">
            <span>{kafkaCount ?? "…"} brokers</span>
          </div>
        </Link>
      </div>
    </>
  );
}
