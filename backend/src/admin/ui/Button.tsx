'use client'

import { Button as ButtonPrimitive } from '@base-ui/react/button'

type Props = ButtonPrimitive.Props & { variant?: 'default' | 'outline' }

export function Button({ variant = 'outline', type = 'button', ...props }: Props) {
  return <ButtonPrimitive data-slot="button" data-variant={variant} type={type} {...props} />
}
