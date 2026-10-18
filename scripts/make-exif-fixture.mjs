import sharp from 'sharp';
import piexif from 'piexifjs';
import fs from 'node:fs';

const w = 1600, h = 1100;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0b2436"/><stop offset=".55" stop-color="#1d5b6f"/><stop offset="1" stop-color="#f5a45a"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<circle cx="1160" cy="330" r="150" fill="#ffe4a8" opacity=".8"/>
<path d="M0 780 Q300 620 620 760 T1600 690 V1100 H0Z" fill="#071620"/>
<path d="M0 900 Q420 780 800 875 T1600 820 V1100 H0Z" fill="#030b12"/>
<text x="90" y="160" font-family="Noto Sans CJK SC" font-size="30" fill="#d8fbff" letter-spacing="8">EXIF UPLOAD TEST</text>
<text x="90" y="930" font-family="Noto Sans CJK SC" font-size="64" font-weight="700" fill="#ffffff">杭州 · 西湖</text>
<text x="90" y="985" font-family="Noto Sans CJK SC" font-size="25" fill="#ffe4b6" letter-spacing="5">30.25 N / 120.1667 E</text>
</svg>`;
const jpg = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer();
const dataUrl = 'data:image/jpeg;base64,' + jpg.toString('base64');
const exifObj = {
  '0th': {
    [piexif.ImageIFD.Make]: 'TestOptics',
    [piexif.ImageIFD.Model]: 'Atlas One',
    [piexif.ImageIFD.DateTime]: '2024:10:05 14:30:00',
    [piexif.ImageIFD.Orientation]: 1,
  },
  'Exif': {
    [piexif.ExifIFD.DateTimeOriginal]: '2024:10:05 14:30:00',
    [piexif.ExifIFD.FNumber]: [28, 10],
    [piexif.ExifIFD.ExposureTime]: [1, 250],
    [piexif.ExifIFD.ISOSpeedRatings]: 200,
    [piexif.ExifIFD.FocalLength]: [35, 1],
    [piexif.ExifIFD.LensModel]: 'Atlas 35mm f/2.8',
  },
  'GPS': {
    [piexif.GPSIFD.GPSLatitudeRef]: 'N',
    [piexif.GPSIFD.GPSLatitude]: [[30, 1], [15, 1], [0, 1]],
    [piexif.GPSIFD.GPSLongitudeRef]: 'E',
    [piexif.GPSIFD.GPSLongitude]: [[120, 1], [10, 1], [0, 1]],
    [piexif.GPSIFD.GPSDateStamp]: '2024:10:05',
  },
};
const withExif = piexif.insert(piexif.dump(exifObj), dataUrl);
fs.writeFileSync('/tmp/lumen-exif-test.jpg', Buffer.from(withExif.split(',')[1], 'base64'));
console.log('wrote /tmp/lumen-exif-test.jpg', fs.statSync('/tmp/lumen-exif-test.jpg').size);
