import { useContext, useState } from "react";

// components
import { PageFooter, ConfirmationModal } from "@/components";

// context
import { GlobalDispatchContext } from "@/context/GlobalContext";
import { ErrorType } from "@/context/types";

// utils
import { backendAPI, setErrorMessage } from "@/utils";

export const AdminView = () => {
  const dispatch = useContext(GlobalDispatchContext);

  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [areButtonsDisabled, setAreButtonsDisabled] = useState(false);

  const handleToggleShowConfirmationModal = () => {
    setShowConfirmationModal(!showConfirmationModal);
  };

  const handleDropAsset = async () => {
    setAreButtonsDisabled(true);

    backendAPI
      .post("/dropped-asset")
      .then(() => {
        backendAPI.put("/world/fire-toast", { title: "Asset successfully dropped!" });
      })
      .catch((error) => setErrorMessage(dispatch, error as ErrorType))
      .finally(() => {
        setAreButtonsDisabled(false);
      });
  };

  const handleRemoveDroppedAssets = async () => {
    setAreButtonsDisabled(true);

    backendAPI
      .post("/remove-dropped-assets")
      .then(() => {
        backendAPI.put("/world/fire-toast", {
          title: "Dropped assets successfully removed!",
          text: "All dropped assets with matching unique name have been removed from this world.",
        });
      })
      .catch((error) => setErrorMessage(dispatch, error as ErrorType))
      .finally(() => {
        setAreButtonsDisabled(false);
      });
  };

  return (
    <div style={{ position: "relative" }}>
      <PageFooter>
        <button className="btn mt-2" disabled={areButtonsDisabled} onClick={handleDropAsset}>
          Drop Asset
        </button>
        <button
          className="btn btn-danger mt-2"
          disabled={areButtonsDisabled}
          onClick={() => handleToggleShowConfirmationModal()}
        >
          Remove Dropped Assets
        </button>
      </PageFooter>

      {showConfirmationModal && (
        <ConfirmationModal
          title="Remove Dropped Assets"
          message="Are you sure you want to remove all dropped assets? This action cannot be undone."
          handleOnConfirm={handleRemoveDroppedAssets}
          handleToggleShowConfirmationModal={handleToggleShowConfirmationModal}
        />
      )}
    </div>
  );
};

export default AdminView;
