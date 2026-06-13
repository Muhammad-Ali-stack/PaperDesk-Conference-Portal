import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;

/*
 * Hashes a plain-text password using bcrypt.
 * Returns the hashed string.
 */
export const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/*
 * Compares a plain-text password against a bcrypt hash.
 * Returns true if they match, false otherwise.
 */
export const comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};
