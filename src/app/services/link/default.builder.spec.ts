import { UserEntity } from "../../entity/user.entity";
import {
    InstallationLinkSupplier,
    TokenSupplier,
} from "./link-builder.supplier";
import { Optional } from "../../util/util.optional";
import { UserRepository } from "../../providers/repository/repository.user";
import { IllegalStateError, NoSuchElementError } from "../../error/errors";
import { DefaultLinkBuilder, DefaultLinkBuilderImpl } from "./default.builder";

describe("A default link builder ", () => {
    const mockInstallationLinkSupplier: InstallationLinkSupplier = <
        InstallationLinkSupplier
    >{
        get: (): Promise<string> => undefined,
    };

    const mockTokenSupplier: TokenSupplier = <TokenSupplier>{
        get: (): Promise<string> => undefined,
    };

    const mockUserRepository: UserRepository = <UserRepository>{
        findAuthenticatedUser: (): Promise<Optional<UserEntity>> => undefined,
    };

    let subject: DefaultLinkBuilder = new DefaultLinkBuilderImpl(
        mockInstallationLinkSupplier,
        mockTokenSupplier,
        mockUserRepository
    );

    beforeEach(() => {
        subject = new DefaultLinkBuilderImpl(
            mockInstallationLinkSupplier,
            mockTokenSupplier,
            mockUserRepository
        );
    });

    describe("building a link", () => {
        describe("without a ref id", () => {
            it("should throw an illegal state error.", async () => {
                await expectAsync(subject.build()).toBeRejectedWithError(
                    IllegalStateError,
                    "Required ref id was not found, ILIAS default link build failed."
                );
            });
        });

        describe("without an authenticated user", () => {
            it("should throw a no such element error.", async () => {
                const refId: number = 15;
                subject.target(refId);

                spyOn(
                    mockUserRepository,
                    "findAuthenticatedUser"
                ).and.returnValue(Promise.resolve(Optional.empty()));

                await expectAsync(subject.build()).toBeRejectedWithError(
                    NoSuchElementError,
                    "No authenticated user found, unable to build default ILIAS link."
                );
            });
        });

        describe("with an authenticated user and a valid ref id", () => {
            it("should build the ILIAS default object link.", async () => {
                const token: string = "auth token";
                const installation: string = "http://ilias.de";
                const refId: number = 15;
                const userId: number = 6;
                subject.target(refId);
                const user: UserEntity = new UserEntity();
                user.iliasUserId = userId;

                spyOn(
                    mockUserRepository,
                    "findAuthenticatedUser"
                ).and.returnValue(Promise.resolve(Optional.of(user)));

                spyOn(mockTokenSupplier, "get").and.returnValue(
                    Promise.resolve(token)
                );

                spyOn(mockInstallationLinkSupplier, "get").and.returnValue(
                    Promise.resolve("http://ilias.de")
                );

                await expectAsync(subject.build()).toBeResolvedTo(
                    `${installation}/goto.php?target=ilias_app_auth|${user.iliasUserId}|${refId}|default|${token}`
                );
            });
        });
    });
});
