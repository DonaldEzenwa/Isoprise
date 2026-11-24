import type { Metadata, Viewport } from 'next';
import { Inter, Manrope } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });

export const metadata: Metadata = {
  title: 'Isoprise — Career and Employability Companion',
  description:
    'Discover learning opportunities, build your professional profile, prepare a quality CV, and develop your career with Isoprise.',
  applicationName: 'Isoprise',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/isoprise-icon.png',
  },
};

export const viewport: Viewport = { themeColor: '#45248f' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${manrope.variable}`}>{children}</body>
    </html>
  );
}
