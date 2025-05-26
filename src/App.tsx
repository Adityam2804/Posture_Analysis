import React, { useState } from 'react';
import Button from './components/Button';
import PoseTracker from './components/PoseTracker';




const App: React.FC = () => {

  const [posture, setShowPosture] = useState(false);



  const handlePosture = () => {
    setShowPosture(true);
  };


  return (

    <div>

      <Button onCreate={handlePosture} name='Open Posture Scan' />
      {posture && <PoseTracker />}
    </div>

  );
};

export default App;
