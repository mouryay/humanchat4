import express, { Router } from 'express';

const settingsRoutes = Router();
settingsRoutes.get('/', (req, res) => {
  res.json({ scope: req.baseUrl });
});

const app = express();
app.use('/settings', settingsRoutes);
app.use('/api/settings', settingsRoutes);

app.listen(4006, () => console.log('ready'));
