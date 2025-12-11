import express, { Router } from 'express';

const router = Router();
router.get('/', (req, res) => {
  res.json({ route: 'root' });
});

const app = express();
app.use('/settings', router);

app.listen(4005, () => {
  console.log('listening');
});
