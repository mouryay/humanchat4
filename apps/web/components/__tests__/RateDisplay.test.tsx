/// <reference types="jest" />
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import RateDisplay from '../RateDisplay';

describe('RateDisplay', () => {
  it('renders badges for charity conversations with donations', () => {
    render(
      <RateDisplay
        conversationType="charity"
        instantRatePerMinute={15}
        charityName="Girls Who Code"
        donationPreference="on"
        scheduledRates={[
          { durationMinutes: 30, price: 225 },
          { durationMinutes: 60, price: 420 }
        ]}
        isOnline
      />
    );

    expect(screen.getByText(/15\.00\/min/i)).toBeInTheDocument();
    expect(screen.getAllByText(/girls who code/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/100% goes to charity/i)).toBeInTheDocument();
    expect(screen.getByText(/accepts tips/i)).toBeInTheDocument();
    expect(screen.getByText(/30 min • \$225\.00/i)).toBeInTheDocument();
  });

  it('shows confidential badge when rate is by request', () => {
    render(
      <RateDisplay
        conversationType="paid"
        confidentialRate
        instantRatePerMinute={20}
        scheduledRates={[]}
        isOnline
      />
    );

    expect(screen.getByText(/available by request/i)).toBeInTheDocument();
    expect(screen.queryByText(/20\.00\/min/i)).not.toBeInTheDocument();
  });
});
