export const compare = jest.fn().mockResolvedValue(true);
export const hash = jest.fn().mockResolvedValue('$2b$10$hashedpassword');
export const genSalt = jest.fn().mockResolvedValue('$2b$10$saltsalt');
