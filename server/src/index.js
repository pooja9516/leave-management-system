import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import app from './app.js';

connectDB(env.MONGO_URI).then(() => {
  app.listen(env.PORT, () => console.log(`Server running on http://localhost:${env.PORT}`));
});
