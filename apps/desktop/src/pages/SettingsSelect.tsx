import { ThemedSelect as BaseThemedSelect, type ThemedSelectProps } from '../components/ThemedSelect';

type SettingsSelectProps<T extends string> = Omit<ThemedSelectProps<T>, 'menuPlacement'>;

export function ThemedSelect<T extends string>({ className = '', ...props }: SettingsSelectProps<T>) {
  const scopedClassName = `settings-select${className ? ` ${className}` : ''}`;
  return <BaseThemedSelect {...props} className={scopedClassName} menuPlacement="bottom" />;
}
