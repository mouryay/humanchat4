import app from '../dist/src/server/app.js';

const stack = app.router?.stack ?? [];
for (const layer of stack) {
  if (layer?.route) {
    console.log('ROUTE', layer.route?.path, layer.route?.methods);
  } else if (layer?.name === 'router') {
    console.log('MOUNT', layer?.path);
  } else {
    console.log('LAYER', layer?.name ?? '(anon)', layer?.path, layer?.regexp?.toString());
  }
}
