import * as Yup from 'yup';

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const emailField = Yup.string().trim().required('Email address is required').matches(EMAIL_REGEX, 'Enter a valid email address');
export const loginValidationSchema = Yup.object({ email: emailField, password: Yup.string().required('Password is required') });
export const signupValidationSchema = loginValidationSchema.shape({ name: Yup.string().trim().required('Full name is required') });
export const employeeSignupValidationSchema = Yup.object({
  fullName: Yup.string().trim().required('Full name is required'), email: emailField,
  password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
  confirmPassword: Yup.string().oneOf([Yup.ref('password')], 'Passwords must match').required('Please confirm your password'),
});
