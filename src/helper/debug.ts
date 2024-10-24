export function Debug(prefix?: string, showArgs?: boolean, trace?: boolean) {
  return (
    _target: unknown,
    _propertyKey: PropertyKey,
    descriptor: PropertyDescriptor,
  ) => {
    const fn = descriptor.value
    descriptor.value = function (...args: unknown[]) {
      const name = `${prefix ? `${prefix} ` : ''}${fn.name}${
        showArgs ? ` args ${JSON.stringify(args)}` : ''
      }${trace ? ` ${new Error().stack?.split('\n')[2]}` : ''}`
      console.time(name)
      const r = fn.apply(this, args)
      console.timeEnd(name)
      return r
    }
  }
}
