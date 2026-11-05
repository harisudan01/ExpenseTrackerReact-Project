import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from './ThemeContext';
import ThemeToggle from './ThemeToggle';

const isDark = () => document.documentElement.classList.contains('dark');

function Readout() {
  const { mode, resolved } = useTheme();
  return <p data-testid="theme">{`${mode}/${resolved}`}</p>;
}

const setup = () =>
  render(
    <ThemeProvider>
      <ThemeToggle />
      <Readout />
    </ThemeProvider>,
  );

/** Fake device preference, with a way to flip it like the OS does at sunset */
function mockSystemDark(initial: boolean) {
  let listener: ((e: MediaQueryListEvent) => void) | null = null;
  const mql = {
    matches: initial,
    addEventListener: (_: string, fn: (e: MediaQueryListEvent) => void) => (listener = fn),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mql));
  return (dark: boolean) => act(() => listener?.({ matches: dark } as MediaQueryListEvent));
}

describe('Theme', () => {
  it('defaults to following the device, which is light when unknown', () => {
    setup();
    expect(screen.getByTestId('theme')).toHaveTextContent('system/light');
    expect(isDark()).toBe(false);
    expect(screen.getByRole('button', { name: 'Match device setting' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches to night and back to day, remembering the choice', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Night (dark theme)' }));
    expect(isDark()).toBe(true);
    expect(localStorage.getItem('et_theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Night (dark theme)' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Day (light theme)' }));
    expect(isDark()).toBe(false);
    expect(localStorage.getItem('et_theme')).toBe('light');
  });

  it('restores the saved theme on load', () => {
    localStorage.setItem('et_theme', 'dark');
    setup();
    expect(screen.getByTestId('theme')).toHaveTextContent('dark/dark');
    expect(isDark()).toBe(true);
  });

  it('ignores a corrupted saved value', () => {
    localStorage.setItem('et_theme', 'purple');
    setup();
    expect(screen.getByTestId('theme')).toHaveTextContent('system/light');
  });

  it('in System mode follows the device, live', () => {
    const setDevice = mockSystemDark(true);
    setup();
    expect(screen.getByTestId('theme')).toHaveTextContent('system/dark');
    expect(isDark()).toBe(true);

    setDevice(false);
    expect(isDark()).toBe(false);
    setDevice(true);
    expect(isDark()).toBe(true);
  });

  it('a manual choice overrides the device setting', async () => {
    const user = userEvent.setup();
    mockSystemDark(true);
    setup();
    await user.click(screen.getByRole('button', { name: 'Day (light theme)' }));
    expect(screen.getByTestId('theme')).toHaveTextContent('light/light');
    expect(isDark()).toBe(false);
  });

  it('still works when storage is blocked', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    setup();
    await user.click(screen.getByRole('button', { name: 'Night (dark theme)' }));
    expect(isDark()).toBe(true);
  });

  it('throws a helpful error outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Readout />)).toThrow('useTheme must be used inside <ThemeProvider>');
    spy.mockRestore();
  });
});
