import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast, type ToastType } from './Toast';

function Trigger({ message, type, duration }: { message: string; type?: ToastType; duration?: number }) {
  const toast = useToast();
  return <button onClick={() => toast(message, type, duration)}>show</button>;
}

const setup = (props: Parameters<typeof Trigger>[0]) =>
  render(
    <ToastProvider>
      <Trigger {...props} />
    </ToastProvider>,
  );

describe('Toast', () => {
  afterEach(() => vi.useRealTimers());

  it('shows a message and hides it after the duration', () => {
    vi.useFakeTimers();
    setup({ message: 'Saved!', duration: 1000 });
    act(() => screen.getByText('show').click());
    expect(screen.getByRole('status')).toHaveTextContent('Saved!');

    act(() => vi.advanceTimersByTime(1001));
    expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
  });

  it('can be dismissed with the close button', async () => {
    const user = userEvent.setup();
    setup({ message: 'Hello', type: 'info' });
    await user.click(screen.getByText('show'));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Hello')).not.toBeInTheDocument();
  });

  it('keeps at most 4 toasts on screen', async () => {
    const user = userEvent.setup();
    setup({ message: 'Again', type: 'warning' });
    for (let i = 0; i < 6; i++) await user.click(screen.getByText('show'));
    expect(screen.getAllByRole('status')).toHaveLength(4);
  });

  it.each(['success', 'error', 'warning', 'info'] as ToastType[])('renders the %s style', async (type) => {
    const user = userEvent.setup();
    setup({ message: `msg-${type}`, type });
    await user.click(screen.getByText('show'));
    expect(screen.getByText(`msg-${type}`)).toBeInTheDocument();
  });

  it('is a no-op outside a provider', async () => {
    const user = userEvent.setup();
    render(<Trigger message="nowhere" />);
    await user.click(screen.getByText('show'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
