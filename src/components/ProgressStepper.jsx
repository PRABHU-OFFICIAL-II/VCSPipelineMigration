import React from 'react';
import './ProgressStepper.css';

const STEPS = ['Login (Dev)', 'Select Assets', 'Process', 'Execute Pull'];

function ProgressStepper({ currentStep }) {
  return (
    <div className="stepper-wrapper">
      {STEPS.map((step, index) => (
        <React.Fragment key={step}>
          <div className={`stepper-step ${
            index < currentStep ? 'completed' :
            index === currentStep ? 'active' : 'pending'
          }`}>
            <div className="stepper-circle">
              {index < currentStep ? <span className="stepper-check">&#10003;</span> : index + 1}
            </div>
            <span className="stepper-label">{step}</span>
          </div>
          {index < STEPS.length - 1 && (
            <div className={`stepper-connector ${index < currentStep ? 'completed' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default ProgressStepper;
