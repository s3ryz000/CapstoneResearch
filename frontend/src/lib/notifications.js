/**
 * Staff dashboard notification helper using Sileo.
 */
import { sileo } from 'sileo';

const defaultPosition = 'top-right';
const defaultDuration = 4000;

export const staffToast = {
  success: (title, description) => {
    sileo.success({ title, description: description ?? '', position: defaultPosition, duration: defaultDuration });
  },
  error: (title, description) => {
    sileo.error({ title, description: description ?? '', position: defaultPosition, duration: defaultDuration });
  },
  info: (title, description) => {
    sileo.info({ title, description: description ?? '', position: defaultPosition, duration: defaultDuration });
  },
  warning: (title, description) => {
    sileo.warning({ title, description: description ?? '', position: defaultPosition, duration: defaultDuration });
  },
};

/** Admin dashboard notifications  */
export const adminToast = { ...staffToast };

/** Student dashboard notifications */
export const studentToast = { ...staffToast };

export default staffToast;
