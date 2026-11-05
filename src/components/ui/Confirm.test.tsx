import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ConfirmProvider, useConfirm } from './Confirm';

function Asker({ danger }: { danger?: boolean }) {
  const confirm = useConfirm();
  const [answer, setAnswer] = useState('none');
  return (
    <>
      <button
        onClick={async () =>
          setAnswer(String(await confirm({ message: 'Really?', title: 'Check', confirmText: 'Do it', danger })))
        }
      >
        ask
      </button>
      <output>{answer}</output>
    </>
  );
}

const setup = (danger?: boolean) =>
  render(
    <ConfirmProvider>
      <Asker danger={danger} />
    </ConfirmProvider>,
  );

describe('useConfirm', () => {
  it('resolves true when confirmed', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText('ask'));
    expect(screen.getByRole('dialog')).toHaveTextContent('Really?');
    await user.click(screen.getByRole('button', { name: 'Do it' }));
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('resolves false on Cancel', async () => {
    const user = userEvent.setup();
    setup(true);
    await user.click(screen.getByText('ask'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('false')).toBeInTheDocument();
  });

  it('resolves false on Escape', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByText('ask'));
    await user.keyboard('{Escape}');
    expect(screen.getByText('false')).toBeInTheDocument();
  });

  it('uses the danger button style for destructive actions', async () => {
    const user = userEvent.setup();
    setup(true);
    await user.click(screen.getByText('ask'));
    expect(screen.getByRole('button', { name: 'Do it' })).toHaveClass('btn-danger');
  });
});
