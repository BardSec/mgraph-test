import express from 'express';
import cors from 'cors';
import health from './routes/health';
import metrics from './routes/metrics';
import events from './routes/events';
import directory from './routes/directory';
import sharing from './routes/sharing';
import dashboard from './routes/dashboard';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/health', health);
app.use('/metrics', metrics);
app.use('/events', events);
app.use('/directory', directory);
app.use('/sharing', sharing);
app.use('/dashboard', dashboard);

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => {
  console.log(`Security Pulse API listening on ${port}`);
});
