import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

import { Quantum } from "ldrs/react";
import "ldrs/react/Quantum.css";
import { Button } from "../../components/ui/Button";
import logo from "../../../assets/logo.svg";

export const handle = {
    breadcrumb: "Authentication",
};

// Original Auth component commented out for now
// const Auth = () => {
//     const auth = useAuth();

//     // const signoutRedirect = () => {
//     //     const clientId = "qb0migspdlsa87cqar363sbdb";
//     //     const logoutUri = "<logout uri>";
//     //     const cognitoDomain =
//     //         "https://eu-west-3s4bfk6epz.auth.eu-west-3.amazoncognito.com";
//     //     window.location.href =
//     //         `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${ 
//     //             encodeURIComponent(logoutUri)
//     //         }`;
//     // };

//     useEffect(() => {
//         console.log(auth);
//     }, [auth]);

//     if (auth.isLoading) {
//         return (
//             <div className="flex justify-center items-center h-screen">
//                 <Quantum
//                     size="45"
//                     speed="1.75"
//                     color="black"
//                 />

//                 {auth.error && toast.error(auth.error.message)}
//             </div>
//         );
//     }

//     if (auth.isAuthenticated) {
//         return <Navigate to="/" />;
//     }

//     return (
//         <div className="p-12 bg-white bg-gradient-to-br from-[#14213D] to-white h-screen w-screen flex justify-center items-center">
//             <div className="flex flex-col gap-4 bg-white p-12 rounded-lg">
//                 <img src={logo} alt="logo" className="size-40 mx-auto" />
//                 <h1 className="text-4xl">
//                     What{" "}
//                     <span className="font-bold  text-[#FCA311]">might y</span>ou
//                     make?
//                 </h1>
//                 <Button
//                     onClick={() => auth.signinRedirect()}
//                     className="bg-[#FCA311] dark:bg-[#3700FF] text-white dark:hover:bg-[#3700FF]/80 dark:hover:text-white "
//                 >
//                     Authenticate
//                 </Button>
//             </div>
//         </div>
//     );
// };

// Placeholder Auth component
export default function AuthPlaceholder() {
  return (
    <div>
      <h1>Auth Page</h1>
    </div>
  );
}

// export default Auth; // Export the placeholder instead
