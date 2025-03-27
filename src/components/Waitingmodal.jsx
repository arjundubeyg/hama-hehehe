const WaitingModal = () => {
    return (
      <div className="modal fixed inset-0 bg-black/45 z-50 flex justify-center items-center">
        <span 
          id="spinner" 
          className="text-white font-bold h-[200px] w-[200px] flex items-center justify-center rounded-full animate-pulse"
        >
          Waiting For Someone...
        </span>
      </div>
    );
  };
  
  export default WaitingModal;