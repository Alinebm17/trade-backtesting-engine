export const checkNumber = (num?: string) => {
  return num && num !== '' && !isNaN(+num)
}
