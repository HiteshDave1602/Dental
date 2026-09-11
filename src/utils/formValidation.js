import * as Yup from 'yup';
import { emailField } from './authValidation';

export const planValidationSchema = Yup.object({
    name: Yup.string().trim().required('Plan name is required'),
    price_rupee: Yup.number()
        .typeError('Enter a valid price')
        .min(0, 'Price cannot be negative')
        .required('Price is required'),
    credits: Yup.number()
        .typeError('Enter a valid number')
        .integer('Credits must be a whole number')
        .min(0, 'Credits cannot be negative')
        .required('Credits are required'),
    duration_days: Yup.number()
        .typeError('Enter a valid number')
        .integer('Duration must be a whole number')
        .min(1, 'Duration must be at least 1 day')
        .required('Duration is required'),
    description: Yup.string().trim(),
});

export const userValidationSchema = Yup.object({
    username: Yup.string().trim().required('Username is required'),
    email: emailField,
    password: Yup.string().min(6, 'Password must be at least 6 characters').required('Password is required'),
    planId: Yup.string(),
});

export const libraryValidationSchema = Yup.object({
    company_name: Yup.string().trim().required('Company name is required'),
    tolerance_degree: Yup.number()
        .typeError('Enter a valid number')
        .min(0, 'Tolerance cannot be negative')
        .required('Tolerance degree is required'),
    angle_degree: Yup.number()
        .typeError('Enter a valid number')
        .required('Angle degree is required'),
    manufacturer_id: Yup.string().trim(),
    alignment_vendor_id: Yup.string().trim().required('Select an alignment vendor'),
    bundleFile: Yup.mixed().required('A vendor bundle (.zip) is required'),
});