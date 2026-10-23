import request from 'supertest';
import app from '../../src/app.js';
import User from '../../src/models/User.js';

export const PASSWORD = 'secret123';

let counter = 0;
export const makeUser = (data = {}) => {
  counter += 1;
  return User.create({
    name: `User ${counter}`,
    email: `user${counter}@test.com`,
    password: PASSWORD,
    ...data,
  });
};

export const tokenFor = async (user) => {
  const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD });
  return res.body.token;
};

// Returns a supertest agent-like helper that sends the user's token.
export const as = async (user) => {
  const token = await tokenFor(user);
  const auth = (req) => req.set('Authorization', `Bearer ${token}`);
  return {
    get: (url) => auth(request(app).get(url)),
    post: (url, body) => auth(request(app).post(url)).send(body),
    patch: (url, body) => auth(request(app).patch(url)).send(body),
    delete: (url) => auth(request(app).delete(url)),
  };
};
