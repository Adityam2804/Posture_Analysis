import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import App from './App';


test('renders Create Profile and Show Table buttons', () => {
  render(

    <App />

  );

  expect(screen.getByText(/Create Profile/i)).toBeInTheDocument();
  expect(screen.getByText(/Show Table/i)).toBeInTheDocument();
  const createButton = screen.getByText('Create Profile');
  fireEvent.click(createButton);
  expect(screen.getByText(/Reset Password/i)).toBeInTheDocument();
  const showTableButton = screen.getByText('Show Table');
  fireEvent.click(showTableButton);
  expect(document.querySelector('.antd-loader-container')).toBeInTheDocument()
});


