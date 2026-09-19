import { cloudinaryThumb, cloudinaryLqip } from './cloudinary';

test('cloudinaryThumb inserisce la trasformazione negli URL Cloudinary', () => {
  const url = 'https://res.cloudinary.com/demo/image/upload/v1/can.jpg';
  expect(cloudinaryThumb(url, 400, 400)).toBe(
    'https://res.cloudinary.com/demo/image/upload/c_fit,w_400,h_400,f_auto,q_auto/v1/can.jpg',
  );
});

test('cloudinaryThumb lascia invariati gli URL non-Cloudinary', () => {
  expect(cloudinaryThumb('https://cdn.example/x.jpg')).toBe('https://cdn.example/x.jpg');
  expect(cloudinaryThumb(undefined)).toBe('');
});

test('cloudinaryLqip produce la versione minuscola sfocata, vuoto se non-Cloudinary', () => {
  const url = 'https://res.cloudinary.com/demo/image/upload/v1/can.jpg';
  expect(cloudinaryLqip(url)).toContain('/upload/w_20,e_blur:200,q_auto,f_auto/');
  expect(cloudinaryLqip('https://cdn.example/x.jpg')).toBe('');
});
