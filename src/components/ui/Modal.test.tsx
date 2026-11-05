import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';
import { Drawer } from './Drawer';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hidden">
        body
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows title, subtitle, body and footer', () => {
    render(
      <Modal open onClose={() => {}} title="My title" subtitle="Sub" footer={<button>OK</button>} icon={<span>i</span>}>
        Body text
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('My title');
    expect(dialog).toHaveTextContent('Sub');
    expect(dialog).toHaveTextContent('Body text');
    expect(screen.getByRole('button', { name: 'OK' })).toBeInTheDocument();
  });

  it('closes via the X button, Escape, and backdrop click', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(
      <Modal open onClose={onClose} title="T">
        x
      </Modal>,
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');
    // backdrop is the first child of the portal wrapper
    await user.click(document.body.querySelector('.backdrop-blur-\\[2px\\]')!);
    expect(onClose).toHaveBeenCalledTimes(3);
    expect(container).toBeEmptyDOMElement(); // rendered into a portal on <body>
  });

  it('locks page scroll while open and restores it after', () => {
    const { rerender } = render(
      <Modal open onClose={() => {}} title="T">
        x
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender(
      <Modal open={false} onClose={() => {}} title="T">
        x
      </Modal>,
    );
    expect(document.body.style.overflow).toBe('');
  });

  it('Escape only closes the topmost overlay (modal over drawer)', async () => {
    const user = userEvent.setup();
    const closeDrawer = vi.fn();
    const closeModal = vi.fn();
    render(
      <>
        <Drawer open onRequestClose={closeDrawer}>
          drawer
        </Drawer>
        <Modal open onClose={closeModal} title="On top">
          modal
        </Modal>
      </>,
    );
    await user.keyboard('{Escape}');
    expect(closeModal).toHaveBeenCalledTimes(1);
    expect(closeDrawer).not.toHaveBeenCalled();
  });
});

describe('Drawer', () => {
  it('renders children only when open and closes on backdrop click', async () => {
    const user = userEvent.setup();
    const onRequestClose = vi.fn();
    const { rerender } = render(
      <Drawer open={false} onRequestClose={onRequestClose}>
        panel
      </Drawer>,
    );
    expect(screen.queryByText('panel')).not.toBeInTheDocument();

    rerender(
      <Drawer open onRequestClose={onRequestClose}>
        panel
      </Drawer>,
    );
    expect(screen.getByRole('dialog')).toHaveTextContent('panel');
    await user.click(document.body.querySelector('.backdrop-blur-\\[2px\\]')!);
    expect(onRequestClose).toHaveBeenCalled();
  });
});
