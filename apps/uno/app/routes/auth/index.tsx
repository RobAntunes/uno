import { useEffect } from "react";
import { useAuth } from "react-oidc-context";
import { toast } from "sonner";
import { Navigate } from "react-router";

import { Quantum } from "ldrs/react";
import "ldrs/react/Quantum.css";
import { Button } from "../../components/ui/Button";

const Auth = () => {
    const auth = useAuth();

    const signoutRedirect = () => {
        const clientId = "qb0migspdlsa87cqar363sbdb";
        const logoutUri = "<logout uri>";
        const cognitoDomain =
            "https://eu-west-3s4bfk6epz.auth.eu-west-3.amazoncognito.com";
        window.location.href =
            `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${
                encodeURIComponent(logoutUri)
            }`;
    };

    useEffect(() => {
        console.log(auth);
    }, [auth]);

    if (auth.isLoading) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Quantum
                    size="45"
                    speed="1.75"
                    color="black"
                />

                {auth.error && toast.error(auth.error.message)}
            </div>
        );
    }

    if (auth.isAuthenticated) {
        return <Navigate to="/" />;
    }

    return (
        <div>
            <Button onClick={() => auth.signinRedirect()}>
                Sign In
            </Button>
            <Button onClick={() => signoutRedirect()}>
                Sign Out
            </Button>
        </div>
    );
};

export default Auth;
