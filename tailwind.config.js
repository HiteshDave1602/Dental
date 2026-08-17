/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9',
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                },
                secondary: {
                    50: '#f0fdfa',
                    100: '#ccfbf1',
                    200: '#99f6e4',
                    300: '#5eead4',
                    400: '#2dd4bf',
                    500: '#14b8a6',
                    600: '#0d9488',
                    700: '#0f766e',
                    800: '#115e59',
                    900: '#134e4a',
                },
                clinical: {
                    blue: '#2badee',
                    teal: '#14b8a6',
                    soft: '#f8fafc',
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                employeeHeading: ['Space Grotesk', 'sans-serif'],
            },
            keyframes: {
                pulseCyan: {
                    '0%, 100%': { boxShadow: '0 0 0 0 rgba(7, 42, 200, 0.35)' },
                    '50%': { boxShadow: '0 0 0 10px rgba(106, 176, 227, 0.12)' },
                },
                authVideoToRegister: {
                    '0%': { left: '0', width: '50%', borderRadius: '0 48% 48% 0' },
                    '46%, 58%': { left: '0', width: '100%', borderRadius: '0' },
                    '100%': { left: '50%', width: '50%', borderRadius: '48% 0 0 48%' },
                },
                authVideoToLogin: {
                    '0%': { left: '50%', width: '50%', borderRadius: '48% 0 0 48%' },
                    '46%, 58%': { left: '0', width: '100%', borderRadius: '0' },
                    '100%': { left: '0', width: '50%', borderRadius: '0 48% 48% 0' },
                },
            },
            animation: {
                'pulse-cyan': 'pulseCyan 1.8s infinite',
                'auth-video-to-register': 'authVideoToRegister 1000ms cubic-bezier(0.65, 0, 0.35, 1) both',
                'auth-video-to-login': 'authVideoToLogin 1000ms cubic-bezier(0.65, 0, 0.35, 1) both',
            },
            boxShadow: {
                'premium': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
                'premium-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.02)',
            }
        },
    },
    plugins: [require("tailwindcss-animate")],
}
