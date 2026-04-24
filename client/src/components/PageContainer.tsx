import { ReactNode, useContext, useState } from "react";

// components
import { AdminView, AdminIconButton, Loading } from "@/components";

// context
import { GlobalStateContext } from "@context/GlobalContext";

export const PageContainer = ({
  children,
  isLoading,
  headerText,
  onInfoClick,
  tabs,
}: {
  children: ReactNode;
  isLoading: boolean;
  headerText?: string;
  onInfoClick?: () => void;
  tabs?: ReactNode;
}) => {
  const { error, isAdmin } = useContext(GlobalStateContext);
  const [showSettings, setShowSettings] = useState(false);

  if (isLoading) return <Loading />;

  return (
    <div className="p-4 mb-28">
      {isAdmin && (
        <AdminIconButton setShowSettings={() => setShowSettings(!showSettings)} showSettings={showSettings} />
      )}
      {tabs}
      {headerText && (
        <div className="pb-6">
          <div className="flex items-center">
            <h2 className="flex-1">{headerText}</h2>
            {onInfoClick && (
              <button className="btn btn-icon" onClick={onInfoClick}>
                <img src="https://sdk-style.s3.amazonaws.com/icons/info.svg" alt="Info" />
              </button>
            )}
          </div>
        </div>
      )}
      {showSettings ? <AdminView /> : children}
      {error && <p className="p3 pt-10 text-center text-error">{error}</p>}
    </div>
  );
};

export default PageContainer;
