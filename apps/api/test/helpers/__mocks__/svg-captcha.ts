export const create = jest.fn().mockReturnValue({
  text: 'mock-captcha-text',
  data: '<svg xmlns="http://www.w3.org/2000/svg"><text>ABCD</text></svg>',
});
