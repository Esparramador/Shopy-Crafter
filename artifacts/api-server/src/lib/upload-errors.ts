/** Rechazo de multer (tipo de archivo no admitido): 400 con el motivo, no un 500 genérico. */
export function uploadRejected(message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status: 400 });
}
